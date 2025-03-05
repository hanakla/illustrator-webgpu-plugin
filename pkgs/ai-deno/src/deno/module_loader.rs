use cjs_code_analyzer::AiDenoCjsCodeAnalyzer;
use deno_error::JsErrorBox;
use deno_graph::{ModuleGraph, ModuleSpecifier};
use deno_resolver::{
    cjs::CjsTracker,
    npm::{
        ByonmNpmResolver, ByonmNpmResolverCreateOptions, CreateInNpmPkgCheckerOptions,
        DenoInNpmPackageChecker,
    },
};
use deno_runtime::{
    deno_core::{
        error::ModuleLoaderError, url::Url, ModuleLoadResponse, ModuleLoader, ModuleSource,
        ModuleSourceCode, ModuleType, RequestedModuleType, ResolutionKind,
    },
    deno_fs::{sync::MaybeArc, RealFs},
    deno_node::{NodeExtInitServices, NodeResolver, NodeResolverRc},
};
use futures::TryFutureExt;
use node_resolver::{
    analyze::NodeCodeTranslator,
    cache::{NodeResolutionSys, NodeResolutionThreadLocalCache},
    DenoIsBuiltInNodeModuleChecker, NodeResolutionKind, PackageJsonResolver, ResolutionMode,
};
use npm_package_manager::{parse_npm_specifier, NpmPackageManager};
use require_loader::AiDenoRequireLoader;
use std::{borrow::Cow, path::PathBuf, rc::Rc, sync::Arc};
use sys_traits::impls::RealSys;

const NODE_MODULES_DIR: &str = "node_modules";
const JSR_REGISTRY_URL: &str = "https://jsr.io";

mod cache_provider;

use crate::dai_println;

mod cache_db;
mod cjs_code_analyzer;
mod npm_client;
pub mod npm_package_manager;
mod require_loader;

// struct EmptyPackageFolderResolver;
// impl NpmPackageFolderResolver for EmptyPackageFolderResolver {
//     fn resolve_package_folder_from_package(
//         &self,
//         specifier: &str,
//         referrer: &node_resolver::UrlOrPathRef,
//     ) -> Result<PathBuf, node_resolver::errors::PackageFolderResolveError> {
//         Err(PackageNotFoundError {
//             package_name: specifier.to_string(),
//             referrer: referrer.display(),
//             referrer_extra: None,
//         }
//         .into())
//     }
// }

#[derive(Clone)]
pub struct AiDenoModuleLoader {
    // pub package_root_dir: PathBuf,
    // pub cache_provider: Arc<cache_provider::MemoryModuleCacheProvider>,
    pub node_resolver: NodeResolverRc<NpmPackageManager, NpmPackageManager, RealSys>,
    // module_graph: ModuleGraph,
    // pub byonm: MaybeArc<AiDenoNpmPackageFolderResolver>,
    // pub in_npm_pkg_checker: NpmPackageManager,
    pub require_loader: AiDenoRequireLoader,
    // pub pkg_json_folder_resolver: AiDenoNpmPackageFolderResolver,
    pub pkg_json_resolver: MaybeArc<PackageJsonResolver<RealSys>>,
    pub cjs_translator: MaybeArc<
        NodeCodeTranslator<
            AiDenoCjsCodeAnalyzer,
            NpmPackageManager,
            DenoIsBuiltInNodeModuleChecker,
            NpmPackageManager,
            RealSys,
        >,
    >,
    pub pkg_manager: NpmPackageManager,
}

impl AiDenoModuleLoader {
    pub fn new(package_root_dir: PathBuf) -> Self {
        let root_node_modules_dir = package_root_dir.join("npm");

        let real_sys = RealSys::default();

        let pkg_json_resolver = MaybeArc::new(PackageJsonResolver::new(real_sys.clone(), None));
        let thread_local_cache = MaybeArc::new(NodeResolutionThreadLocalCache);
        let node_resolution_sys =
            NodeResolutionSys::new(real_sys.clone(), Some(thread_local_cache));

        // let byonm_npm_resolver = ManagedNpmResolver::new(ManagedNpmResolverCreateOptions {
        //     npm_cache_dir: MaybeArc::new(NpmCacheDir::new(
        //         &real_sys.clone(),
        //         package_root_dir.join(".deno_cache"),
        //         vec![Url::parse("https://registry.npmjs.org").unwrap()],
        //     )),
        //     npm_resolution: NpmResolutionCellRc::new(NpmResolutionCell::new(
        //         NpmResolutionSnapshot::default(),
        //     )),
        //     maybe_node_modules_path: Some(root_node_modules_dir.join("node_modules")),
        //     npm_system_info: NpmSystemInfo::default(),
        //     npmrc: MaybeArc::new(ResolvedNpmRc {
        //         default_config: RegistryConfigWithUrl {
        //             registry_url: url::Url::from_str("https://registry.npmjs.org").unwrap(),
        //             config: Arc::new(Default::default()),
        //         },
        //         registry_configs: HashMap::new(),
        //         scopes: HashMap::new(),
        //     }),
        //     sys: real_sys.clone(),
        // });

        let byonm_npm_resolver = ByonmNpmResolver::new(ByonmNpmResolverCreateOptions {
            root_node_modules_dir: Some(root_node_modules_dir.clone()),
            pkg_json_resolver: pkg_json_resolver.clone(),
            sys: node_resolution_sys.clone(),
        });

        let pkg_manager = NpmPackageManager::new(root_node_modules_dir.clone());

        // let in_npm_pkg_checker = DenoInNpmPackageChecker::new(CreateInNpmPkgCheckerOptions::Byonm);

        let node_resolver = MaybeArc::new(NodeResolver::new(
            pkg_manager.clone(),
            DenoIsBuiltInNodeModuleChecker {},
            pkg_manager.clone(),
            pkg_json_resolver.clone(),
            node_resolution_sys,
            node_resolver::ConditionsFromResolutionMode::default(),
        ));

        let cjs_tracker = CjsTracker::new(
            pkg_manager.clone(),
            pkg_json_resolver.clone(),
            deno_resolver::cjs::IsCjsResolutionMode::ImplicitTypeCommonJs,
        );

        let cjs_translator = NodeCodeTranslator::new(
            AiDenoCjsCodeAnalyzer::new(MaybeArc::new(RealFs::default()), cjs_tracker),
            pkg_manager.clone(),
            node_resolver.clone(),
            pkg_manager.clone(),
            pkg_json_resolver.clone(),
            real_sys.clone(),
        );

        // let module_graph = ModuleGraph::new(deno_graph::GraphKind::All);

        let require_loader = AiDenoRequireLoader(MaybeArc::new(RealFs::default()));

        // let pkg_json_folder_resolver = AiDenoNpmPackageFolderResolver {
        //     byonm: byonm_npm_resolver.clone(),
        // };

        Self {
            // package_root_dir,
            // cache_provider: Arc::new(MemoryModuleCacheProvider::default()),
            node_resolver,
            // module_graph,
            // byonm: MaybeArc::new(npm_pkg_folder_resolver),
            // in_npm_pkg_checker,
            require_loader: require_loader,
            // pkg_json_folder_resolver,
            pkg_json_resolver: pkg_json_resolver.clone(),
            cjs_translator: MaybeArc::new(cjs_translator),
            pkg_manager,
        }
    }

    // fn resolve_jsr_module(
    //     &self,
    //     specifier: &str,
    //     referrer: &ModuleSpecifier,
    // ) -> Result<ModuleSpecifier, ModuleLoaderError> {
    //     let package_specifier = specifier.strip_prefix("jsr:").unwrap_or(specifier);

    //     let jsr_url = format!("{}/{}", JSR_REGISTRY_URL, package_specifier);
    //     Url::parse(&jsr_url).map_err(|err| {
    //         ModuleLoaderError::from(JsErrorBox::generic(format!(
    //             "Failed to parse JSR URL: {} - {}",
    //             err
    //         )))
    //     })
    // }

    pub fn init_services(
        self: &Self,
    ) -> NodeExtInitServices<NpmPackageManager, NpmPackageManager, RealSys> {
        NodeExtInitServices {
            node_require_loader: Rc::new(self.require_loader.clone()),
            pkg_json_resolver: self.pkg_json_resolver.clone(),
            node_resolver: self.node_resolver.clone(),
            sys: RealSys::default(),
        }
    }

    async fn resolve_and_ensure_npm_module(
        &self,
        specifier: &str,
        referrer: &ModuleSpecifier,
    ) -> Result<ModuleSpecifier, ModuleLoaderError> {
        dai_println!(
            "resolve_and_ensure_npm_module: {}, referrer: {}",
            specifier,
            referrer
        );

        let package_name = specifier.strip_prefix("npm:").unwrap_or(specifier);

        let npm_client = self.pkg_manager.npm_client.clone();
        let (name, version, _sub_path) = parse_npm_specifier(package_name).map_err(|err| {
            ModuleLoaderError::from(JsErrorBox::generic(format!(
                "Failed to parse npm specifier: {} - {}",
                package_name, err
            )))
        })?;

        let resolved_version = if version.is_none() {
            let (latest_version, _, _) =
                npm_client
                    .get_package_info(&name, None)
                    .await
                    .map_err(|err| {
                        ModuleLoaderError::from(JsErrorBox::generic(format!(
                            "Failed to fetch npm package: {} - {}",
                            name, err
                        )))
                    })?;
            latest_version
        } else {
            version.unwrap()
        };

        let mut package_manager = self.pkg_manager.clone();

        if !package_manager.is_package_installed(&name, resolved_version.as_str()) {
            dai_println!("Dowloading npm package: {}@{:?}", name, resolved_version);

            let npm_package = package_manager
                .install_package_with_deps(&name, resolved_version.as_str(), npm_client)
                .map_err(|err| ModuleLoaderError::from(err))
                .await?;

            dai_println!(
                "Complete to fetch npm package: {}@{} -> {}",
                npm_package.name,
                npm_package.version,
                npm_package.content_path.display()
            );
        } else {
            dai_println!("Package already installed: {}@{:?}", name, resolved_version);
        }

        return Ok(ModuleSpecifier::parse(specifier).unwrap());
    }

    fn resolve_node_builtin(
        &self,
        specifier: &str,
        referrer: &ModuleSpecifier,
    ) -> Result<ModuleSpecifier, ModuleLoaderError> {
        let module_name = specifier.strip_prefix("node:").unwrap_or(specifier);

        let url = self
            .node_resolver
            .resolve(
                module_name,
                referrer,
                ResolutionMode::Import,
                NodeResolutionKind::Execution,
            )
            .map_err(JsErrorBox::from_err)?;

        Ok(url.into_url().unwrap())
    }

    async fn fetch_module_content(
        &self,
        module_specifier: &ModuleSpecifier,
    ) -> Result<(String, ModuleSpecifier), ModuleLoaderError> {
        match module_specifier.scheme() {
            "file" => {
                let path = module_specifier.to_file_path().map_err(|_| {
                    ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "Invalid file path: {}",
                        module_specifier
                    )))
                })?;

                if !path.exists() {
                    return Err(ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "File not found: {}",
                        path.display()
                    ))));
                }

                let content = std::fs::read_to_string(&path).map_err(|err| {
                    ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "Failed to read file: {} - {}",
                        path.display(),
                        err
                    )))
                })?;

                Ok((content, module_specifier.clone()))
            }

            "npm" => {
                let path = module_specifier.path();
                dai_println!("npm path: {}", path);

                let path = self
                    .pkg_manager
                    .resolve_specifier_to_file_path(module_specifier.as_str(), None)
                    .unwrap();

                let content = std::fs::read_to_string(&path).map_err(|err| {
                    ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "Failed to read file: {} - {}",
                        path.display(),
                        err
                    )))
                })?;

                let file_url = deno_path_util::url_from_file_path(path.as_path()).unwrap();

                let content = self
                    .cjs_translator
                    .translate_cjs_to_esm(&file_url, Some(Cow::Borrowed(&content)))
                    .map_err(|e| JsErrorBox::from_err(e))
                    .await?;

                // let content =
                //     ["console.log(import.meta);", content.to_string().as_str()].join("\n");

                dai_println!("Translated content: {}", content);

                Ok((content.to_string(), file_url.clone()))
            }

            "http" | "https" => {
                let client = reqwest::Client::new();
                let response =
                    client
                        .get(module_specifier.as_str())
                        .send()
                        .await
                        .map_err(|err| {
                            ModuleLoaderError::from(JsErrorBox::generic(format!(
                                "HTTP request failed: {} - {}",
                                module_specifier, err
                            )))
                        })?;

                if !response.status().is_success() {
                    return Err(ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "HTTP request failed with status: {}",
                        response.status()
                    ))));
                }

                let content = response.text().await.map_err(|err| {
                    ModuleLoaderError::from(JsErrorBox::generic(format!(
                        "Failed to read HTTP response: {}",
                        err
                    )))
                })?;

                Ok((content, module_specifier.clone()))
            }

            _ => Err(ModuleLoaderError::from(JsErrorBox::generic(format!(
                "Unsupported scheme in module imports: {}",
                module_specifier.scheme()
            )))),
        }
    }

    fn determine_module_type(&self, specifier: &ModuleSpecifier, _code: &str) -> ModuleType {
        if specifier.path().ends_with(".json") {
            return ModuleType::Json;
        }

        ModuleType::JavaScript
    }

    fn resolve_referrer(&self, referrer: &str) -> Result<ModuleSpecifier, ModuleLoaderError> {
        if deno_core::specifier_has_uri_scheme(referrer) {
            deno_core::resolve_url(referrer).map_err(|e| {
                ModuleLoaderError::from(JsErrorBox::type_error(format!("無効なリファラー: {}", e)))
            })
        } else if referrer == "." {
            let current_dir = std::env::current_dir()
                .map_err(|e| ModuleLoaderError::from(JsErrorBox::from_err(e)))?;
            deno_core::resolve_path(referrer, &current_dir)
                .map_err(JsErrorBox::from_err)
                .map_err(Into::into)
        } else {
            let cwd = std::env::current_dir()
                .map_err(|e| ModuleLoaderError::from(JsErrorBox::from_err(e)))?;
            deno_core::resolve_path(referrer, &cwd)
                .map_err(JsErrorBox::from_err)
                .map_err(Into::into)
        }
    }
}

impl ModuleLoader for AiDenoModuleLoader {
    fn resolve(
        &self,
        raw_specifier: &str,
        raw_referrer: &str,
        kind: ResolutionKind,
    ) -> Result<ModuleSpecifier, ModuleLoaderError> {
        dai_println!(
            "resolving: {}, referrer: {}, kind: {:?}",
            raw_specifier,
            raw_referrer,
            kind
        );

        let referrer = self.resolve_referrer(raw_referrer)?;

        if raw_specifier.starts_with("npm:") {
            let package_name = raw_specifier.strip_prefix("npm:").unwrap_or(raw_specifier);
            let npm_url = format!("npm:{}", package_name);
            return Url::parse(&npm_url).map_err(|err| {
                ModuleLoaderError::from(JsErrorBox::generic(format!(
                    "Failed to parse npm URL: {} - {}",
                    npm_url, err
                )))
            });
        } else if raw_specifier.starts_with("node:") {
            return self.resolve_node_builtin(raw_specifier, &referrer);
        }
        // else if raw_specifier.starts_with("jsr:") {
        //     return self.resolve_jsr_module(raw_specifier, &referrer);
        // }

        let result = match deno_core::resolve_import(raw_specifier, raw_referrer) {
            Ok(url) => Ok(url),
            Err(err) => Err(ModuleLoaderError::from(JsErrorBox::from_err(err))),
        };

        dai_println!("resolve request: {:?} -> {:?}", raw_specifier, result);

        result
    }

    fn load(
        &self,
        module_specifier: &ModuleSpecifier,
        maybe_referrer: Option<&ModuleSpecifier>,
        is_dyn_import: bool,
        requested_module_type: RequestedModuleType,
    ) -> ModuleLoadResponse {
        dai_println!(
            "loading: {}, referrer: {:?}, is_dyn_import: {}",
            module_specifier,
            maybe_referrer,
            is_dyn_import
        );

        let module_specifier = module_specifier.clone();
        let maybe_referrer_clone = maybe_referrer.cloned();
        let loader = self.clone();

        ModuleLoadResponse::Async(Box::pin(async move {
            let actual_specifier = if module_specifier.scheme() == "npm" {
                let referrer = maybe_referrer_clone.unwrap_or_else(|| {
                    let current_dir = std::env::current_dir().unwrap();
                    deno_core::resolve_path(".", &current_dir).unwrap()
                });

                let raw_specifier = format!("npm:{}", module_specifier.path());
                loader
                    .resolve_and_ensure_npm_module(&raw_specifier, &referrer)
                    .await?
            } else {
                module_specifier.clone()
            };

            let (content, final_url) = loader.fetch_module_content(&actual_specifier).await?;
            let module_type = loader.determine_module_type(&final_url, &content);

            if module_type == ModuleType::Json && requested_module_type != RequestedModuleType::Json
            {
                return Err(ModuleLoaderError::from(JsErrorBox::generic(
                    "Invalid module type requested",
                )));
            }

            dai_println!("Loaded module: {}", final_url);

            let module_source = ModuleSource::new_with_redirect(
                module_type,
                ModuleSourceCode::String(content.into()),
                &module_specifier,
                &final_url,
                None,
            );

            Ok(module_source)
        }))
    }
}
