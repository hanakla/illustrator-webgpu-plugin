#![allow(unused_imports)]
#![allow(deprecated)]
#![allow(dead_code)]
use crate::module_loader::{ClonableSource, ModuleCacheProvider};
use crate::traits::ToModuleSpecifier;
use crate::transpiler::{transpile, transpile_extension, ExtensionTranspilation};

use deno_ast::MediaType;
use deno_error::JsErrorBox;
use deno_resolver::cjs::CjsTracker;
use deno_runtime::deno_core::{
    anyhow::{anyhow, Error},
    error::{AnyError, ModuleLoaderError},
    futures::FutureExt,
    url::Url,
    FastString, ModuleLoadResponse, ModuleSource, ModuleSourceCode, ModuleSpecifier, ModuleType,
    ResolutionKind,
};
use node_resolver::analyze::NodeCodeTranslator;
use std::borrow::Cow;
use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::{Arc, RwLock};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};
use sys_traits::impls::RealSys;

use crate::ext::node::RustyNodeCodeTranslator;
use crate::ext::node::RustyResolver;
use deno_runtime::deno_node::NodeResolver;
use node_resolver::InNpmPackageChecker;
use node_resolver::{NodeResolutionKind, ResolutionMode};

use super::ImportProvider;

/// Stores the source code and source ma#![allow(deprecated)]p for loaded modules
type SourceMapCache = HashMap<String, (String, Option<Cow<[u8]>>)>;

/// Options for the `RustyLoader` struct
/// Not for public use
#[derive(Default)]
pub struct LoaderOptions {
    /// An optional cache provider to manage module code caching
    pub cache_provider: Option<Box<dyn ModuleCacheProvider>>,

    /// A whitelist of module specifiers that are always allowed to be loaded from the filesystem
    pub fs_whitelist: HashSet<String>,

    /// A cache for source maps for loaded modules
    /// Used for error message generation
    pub source_map_cache: SourceMapCache,

    /// A resolver for node modules
    pub node_resolver: Arc<NodeResolver<RustyResolver, RustyResolver, RealSys>>,

    /// A CJS tracker for managing CJS module loading
    pub cjs_tracker: Arc<CjsTracker<RustyResolver, RealSys>>,

    /// An optional import provider to manage module resolution
    pub import_provider: Option<Box<dyn ImportProvider>>,

    /// A whitelist of custom schema prefixes that are allowed to be loaded
    pub schema_whlist: HashSet<String>,

    /// The current working directory for the loader
    pub cwd: PathBuf,
}

struct NodeProvider {
    rusty_resolver: Arc<RustyResolver>,
    node_resolver: Arc<NodeResolver<RustyResolver, RustyResolver, RealSys>>,
    code_translator: Rc<RustyNodeCodeTranslator>,
}
impl NodeProvider {
    pub fn new(resolver: Arc<RustyResolver>) -> Self {
        let node_resolver = Arc::new(resolver.node_resolver());
        let code_translator = Rc::new(resolver.code_translator(node_resolver.clone()));
        Self {
            rusty_resolver: resolver,
            node_resolver,
            code_translator,
        }
    }
}

/// Internal implementation of the module loader
/// Stores the cache provider, filesystem whitelist, and source map cache
/// Unlike the outer loader, this struture does not need to rely on inner mutability
///
/// Not for public use
pub struct InnerRustyLoader {
    cache_provider: Option<Box<dyn ModuleCacheProvider>>,
    fs_whlist: HashSet<String>,
    source_map_cache: SourceMapCache,
    import_provider: Option<Box<dyn ImportProvider>>,
    schema_whlist: HashSet<String>,
    cwd: PathBuf,
    node_resolver: NodeProvider,
    cjs_tracker: CjsTracker<RustyResolver, RealSys>,
}

impl InnerRustyLoader {
    /// Creates a new instance of `InnerRustyLoader`
    /// An optional cache provider can be provided to manage module code caching, as well as an import provider to manage module resolution.
    pub fn new(options: LoaderOptions) -> Self {
        Self {
            cache_provider: options.cache_provider,
            fs_whlist: options.fs_whitelist,
            source_map_cache: options.source_map_cache,
            import_provider: options.import_provider,
            schema_whlist: options.schema_whlist,
            cwd: options.cwd,
            node_resolver: NodeProvider::new(options.node_resolver),
            cjs_tracker: options.cjs_tracker,
        }
    }

    /// Sets the current working directory for the loader
    pub fn set_current_dir(&mut self, cwd: PathBuf) {
        self.cwd = cwd;
    }

    /// Adds a module specifier to the whitelist
    /// This allows the module to be loaded from the filesystem
    /// If they are included from rust first
    pub fn whitelist_add(&mut self, specifier: &str) {
        self.fs_whlist.insert(specifier.to_string());
    }

    /// Checks if a module specifier is in the whitelist
    /// Used to determine if a module can be loaded from the filesystem
    /// or not if `fs_import` is disabled
    pub fn whitelist_has(&self, specifier: &str) -> bool {
        self.fs_whlist.contains(specifier)
    }

    #[allow(clippy::unused_self)]
    pub fn transpile_extension(
        &self,
        specifier: &FastString,
        code: &FastString,
    ) -> Result<ExtensionTranspilation, AnyError> {
        let specifier = specifier.as_str().to_module_specifier(&self.cwd)?;
        let code = code.as_str();
        transpile_extension(&specifier, code)
    }

    pub fn resolve(
        &mut self,
        raw_specifier: &str,
        referrer: &str,
        kind: deno_core::ResolutionKind,
    ) -> Result<ModuleSpecifier, ModuleLoaderError> {
        let referrer = if referrer == "." {
            if kind != ResolutionKind::MainModule {
                return Err(JsErrorBox::generic(format!(
                    "Expected to resolve main module, got {:?} instead.",
                    kind
                ))
                .into());
            }
            let current_dir = std::env::current_dir().unwrap();
            deno_core::resolve_path(".", &current_dir).map_err(JsErrorBox::from_err)?
        } else {
            Url::parse(referrer).map_err(|err| {
                JsErrorBox::type_error(format!("Referrer uses invalid specifier: {}", err))
            })?
        };
        let referrer_kind = if self
            .cjs_tracker
            .is_maybe_cjs(&referrer, MediaType::from_specifier(&referrer))
            .map_err(JsErrorBox::from_err)?
        {
            ResolutionMode::Require
        } else {
            ResolutionMode::Import
        };

        if self.node_resolver.node_resolver.in_npm_package(&referrer) {
            return Ok(self
                .node_resolver
                .node_resolver
                .resolve(
                    raw_specifier,
                    &referrer,
                    referrer_kind,
                    NodeResolutionKind::Execution,
                )
                .and_then(|res| res.into_url())
                .map_err(JsErrorBox::from_err)?);
        }

        // let mapped_resolution = self.shared.workspace_resolver.resolve(
        //     raw_specifier,
        //     &referrer,
        //     deno_resolver::workspace::ResolutionKind::Execution,
        // )

        Err(ModuleLoaderError::Unsupported {
            specifier: raw_specifier.to_string(),
            maybe_referrer: referrer.to_string(),
        })
    }

    pub fn load(
        inner: Rc<RefCell<Self>>,
        module_specifier: &ModuleSpecifier,
        maybe_referrer: Option<&ModuleSpecifier>,
        is_dyn_import: bool,
        requested_module_type: deno_core::RequestedModuleType,
    ) -> deno_core::ModuleLoadResponse {
        let module_specifier = module_specifier.clone();
        let maybe_referrer = maybe_referrer.cloned();

        // Check if the module is in the cache first
        if let Some(cache) = &inner.borrow().cache_provider {
            if let Some(source) = cache.get(&module_specifier) {
                return deno_core::ModuleLoadResponse::Sync(Ok(source));
            }
        }

        // Next check the import provider
        let provider_result = inner.borrow_mut().import_provider.as_mut().and_then(|p| {
            p.import(
                &module_specifier,
                maybe_referrer.as_ref(),
                is_dyn_import,
                requested_module_type,
            )
        });
        if let Some(result) = provider_result {
            return ModuleLoadResponse::Async(
                async move {
                    Self::handle_load(inner, module_specifier, |_, _| async move { Err(()) }).await
                }
                .boxed_local(),
            );
        }

        // We check permissions next
        match module_specifier.scheme() {
            // Remote fetch imports
            // #[cfg(feature = "url_import")]
            "https" | "http" => ModuleLoadResponse::Async(
                async move { Self::handle_load(inner, module_specifier, Self::load_remote).await }
                    .boxed_local(),
            ),

            // FS imports
            "file" => ModuleLoadResponse::Async(
                async move { Self::handle_load(inner, module_specifier, Self::load_file).await }
                    .boxed_local(),
            ),

            // Default deny-all
            _ => ModuleLoadResponse::Sync(Err(ModuleLoaderError::Core(JsErrorBox::generic(
                format!(
                    "{} imports are not allowed here: {}",
                    module_specifier.scheme(),
                    module_specifier.as_str()
                ),
            )))),
        }
    }

    #[allow(unused_variables)]
    #[allow(clippy::unused_async)]
    pub async fn translate_cjs(
        inner: Rc<RefCell<Self>>,
        module_specifier: ModuleSpecifier,
        content: String,
    ) -> Result<String, Error> {
        {
            Ok(content)
        }
        {
            let is_npm = inner
                .borrow()
                .node_resolver
                .rusty_resolver
                .in_npm_package(&module_specifier);
            if is_npm {
                let translator = inner.borrow().node_resolver.code_translator.clone();

                let source = translator
                    .translate_cjs_to_esm(
                        &module_specifier,
                        Some(std::borrow::Cow::Borrowed(&content)),
                    )
                    .await?
                    .into_owned();
                Ok(source)
            } else {
                Ok(content)
            }
        }
    }

    #[allow(unused_variables)]
    async fn load_file(
        inner: Rc<RefCell<Self>>,
        module_specifier: ModuleSpecifier,
    ) -> Result<String, ModuleLoaderError> {
        let path = module_specifier
            .to_file_path()
            .map_err(|()| anyhow!("`{module_specifier}` is not a valid file URL."))
            .unwrap();

        let content = tokio::fs::read_to_string(path).await?;
        let content = Self::translate_cjs(inner, module_specifier, content).await?;

        Ok(content)
    }

    async fn load_remote(
        _: Rc<RefCell<Self>>,
        module_specifier: ModuleSpecifier,
    ) -> Result<String, ModuleLoaderError> {
        let response = reqwest::get(module_specifier).await?;
        Ok(response.text().await?)
    }

    /// Loads a module's source code from the cache or from the provided handler
    async fn handle_load<F, Fut>(
        inner: Rc<RefCell<Self>>,
        module_specifier: ModuleSpecifier,
        handler: F,
    ) -> Result<ModuleSource, ModuleLoaderError>
    where
        F: FnOnce(Rc<RefCell<Self>>, ModuleSpecifier) -> Fut,
        Fut: std::future::Future<Output = Result<String, ModuleLoaderError>>,
    {
        // Check if the module is in the cache first
        if let Some(Some(source)) = inner
            .borrow()
            .cache_provider
            .as_ref()
            .map(|p| p.get(&module_specifier))
        {
            return Ok(source);
        }

        //
        // Not in the cache, load the module from the handler
        //

        // Get the module type first
        let extension = Path::new(module_specifier.path())
            .extension()
            .unwrap_or_default();
        let module_type = if extension.eq_ignore_ascii_case("json") {
            ModuleType::Json
        } else {
            ModuleType::JavaScript
        };

        // Load the module code, and transpile it if necessary
        let code = handler(inner.clone(), module_specifier.clone()).await?;
        let (tcode, source_map) = transpile(&module_specifier, &code)?;

        // Create the module source
        let mut source = ModuleSource::new(
            module_type,
            ModuleSourceCode::String(tcode.into()),
            &module_specifier,
            None,
        );

        // Add the source to our source cache
        inner.borrow_mut().add_source_map(
            module_specifier.as_str(),
            code,
            source_map.map(|s| Cow::Owned(s.to_vec())),
        );

        // Cache the source if a cache provider is available
        // Could speed up loads on some future runtime
        if let Some(p) = &mut inner.borrow_mut().cache_provider {
            p.set(&module_specifier, source.clone(&module_specifier));
        }

        // Run import provider post-processing
        if let Some(import_provider) = &mut inner.borrow_mut().import_provider {
            source = import_provider.post_process(&module_specifier, source)?;
        }

        Ok(source)
    }

    /// Returns a reference to a file in the source map cache
    pub fn get_source_map(&self, filename: &str) -> Option<&(String, Option<Cow<[u8]>>)> {
        self.source_map_cache.get(filename)
    }

    /// Adds a source map to the cache
    pub fn add_source_map(
        &mut self,
        filename: &str,
        source: String,
        source_map: Option<Cow<[u8]>>,
    ) {
        self.source_map_cache
            .insert(filename.to_string(), (source, source_map));
    }
}
