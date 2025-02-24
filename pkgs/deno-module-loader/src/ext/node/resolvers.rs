use deno_ast::{MediaType, ModuleSpecifier};
use deno_resolver::{
    cjs::IsCjsResolutionMode,
    npm::{
        ByonmNpmResolver, ByonmNpmResolverCreateOptions, CreateInNpmPkgCheckerOptions,
        DenoInNpmPackageChecker, NpmResolver,
    },
};
use deno_runtime::{
    deno_core::url,
    deno_fs::{sync::MaybeArc, FileSystem, RealFs},
    deno_node::{
        NodeExtInitServices, NodePermissions, NodeRequireLoader, NodeResolver, NodeResolverRc,
    },
    deno_process::NpmProcessStateProvider,
};
use deno_semver::package::PackageReq;
use node_resolver::{
    analyze::NodeCodeTranslator, cache::{NodeResolutionSys, NodeResolutionThreadLocalCache}, errors::{ClosestPkgJsonError, PackageFolderResolveErrorKind, PackageNotFoundError}, DenoIsBuiltInNodeModuleChecker, InNpmPackageChecker, NpmPackageFolderResolver, PackageJsonResolver, PackageJsonResolverRc, ResolutionMode, UrlOrPath, UrlOrPathRef
};
use serde::{Deserialize, Serialize};
use std::{
    borrow::Cow,
    collections::HashMap,
    path::{Path, PathBuf},
    rc::Rc,
    sync::{Arc, RwLock},
};
use sys_traits::impls::RealSys;

use super::cjs_translator::{NodeCodeTranslator, RustyCjsCodeAnalyzer};

const NODE_MODULES_DIR: &str = "node_modules";

/// Package resolver for the `deno_node` extension
#[derive(Debug)]
pub struct RustyResolver {
    fs: Arc<dyn FileSystem + Send + Sync>,
    byonm: ByonmNpmResolver<RealSys>,
    pjson: PackageJsonResolverRc<RealSys>,
    in_npm_pkg_checker: DenoInNpmPackageChecker,
    require_loader: RequireLoader,
    node_resolver: NodeResolverRc<RustyResolver, RustyResolver, RealSys>,
    root_node_modules_dir: Option<PathBuf>,
    mode: IsCjsResolutionMode,
    known: RwLock<HashMap<ModuleSpecifier, bool>>,
}
impl Default for RustyResolver {
    fn default() -> Self {
        Self::new(None, Arc::new(RealFs))
    }
}
impl RustyResolver {
    /// Create a new resolver with the given base directory and filesystem
    pub fn new(base_dir: Option<PathBuf>, fs: Arc<dyn FileSystem + Send + Sync>) -> Self {
        let mut base = base_dir;
        if base.is_none() {
            base = std::env::current_dir().ok();
        }

        let real_sys = RealSys::default();
        let real_sys_arc = MaybeArc::new(real_sys.clone());
        let arc_fs = Arc::new(fs.clone());

        let root_node_modules_dir = base.map(|mut p| {
            p.push(NODE_MODULES_DIR);
            p
        });

        let pjson = MaybeArc::new(PackageJsonResolver::new(real_sys, None));

        let require_loader = Rc::new(real_sys.clone());

        let thread_local_cache = MaybeArc::new(NodeResolutionThreadLocalCache);
        let node_resolution_sys =
            NodeResolutionSys::new(real_sys.clone(), Some(thread_local_cache));

        let byonm = NpmResolver::Byonm(MaybeArc::new(ByonmNpmResolver::new(
            ByonmNpmResolverCreateOptions {
                root_node_modules_dir: root_node_modules_dir.clone(),
                pkg_json_resolver: pjson.clone(),
                sys: node_resolution_sys,
            },
        )));

        let in_npm_pkg_checker = DenoInNpmPackageChecker::new(CreateInNpmPkgCheckerOptions::Byonm),

        let node_resolver = MaybeArc::new(NodeResolver::new(
            in_npm_pkg_checker,
            DenoIsBuiltInNodeModuleChecker {},
            byonm.clone(),
            pjson.clone(),
            node_resolution_sys,
            node_resolver::ConditionsFromResolutionMode::default(),
        ));

        Self {
            fs,
            byonm,
            pjson,
            require_loader,
            in_npm_pkg_checker,
            node_resolver,
            root_node_modules_dir,
            mode: IsCjsResolutionMode::ImplicitTypeCommonJs,
            known: RwLock::new(HashMap::new()),
        }
    }

    /// Returns a structure capable of translating CJS to ESM
    #[must_use]
    pub fn code_translator(
        self: &Arc<Self>,
        node_resolver: Arc<NodeResolver<RustyResolver, RustyResolver, RealSys>>,
    ) -> NodeCodeTranslator<RustyCjsCodeAnalyzer, RustyResolver, RustyResolver, RealSys> {
        let cjs = RustyCjsCodeAnalyzer::new(self.filesystem(), self.clone());
        NodeCodeTranslator::new(
            cjs,
            self.clone(),
            self.clone(),
            self.clone(),
            RealSys::default(),
        )
    }

    /// Returns a node resolver for the resolver
    #[must_use]
    pub fn node_resolver(self: &Arc<Self>) -> MaybeArc<NodeResolver<RustyResolver, RustyResolver, RealSys>> {
        self.node_resolver.clone()
    }

    /// Returns the package.json resolver used by the resolver
    pub fn package_json_resolver(&self) -> PackageJsonResolverRc<RealSys> {
        self.pjson.clone()
    }

    /// Resolves an importalias for a given specifier
    pub fn resolve_alias(&self, specifier: &str, referrer: &Path) -> Option<String> {
        let package = self
            .package_json_resolver()
            .get_closest_package_json(referrer)
            .ok()??;
        let imports = package.imports.as_ref()?;
        let alias = imports.get(specifier)?;

        if let Some(obj) = alias.as_object() {
            if let Some(node) = obj.get("node") {
                if let Some(alias) = node.as_str() {
                    return Some(alias.to_string());
                }
            }
        } else if let Some(str) = alias.as_str() {
            return Some(str.to_string());
        }

        None
    }

    fn get_known_is_cjs(&self, specifier: &ModuleSpecifier) -> Option<bool> {
        self.known
            .read()
            .ok()
            .and_then(|k| k.get(specifier).copied())
    }

    fn set_is_cjs(&self, specifier: &ModuleSpecifier, value: bool) {
        if let Ok(mut known) = self.known.write() {
            known.insert(specifier.clone(), value);
        }
    }

    fn check_based_on_pkg_json(
        &self,
        specifier: &url::Url,
    ) -> Result<ResolutionMode, ClosestPkgJsonError> {
        if self.in_npm_pkg_checker.in_npm_package(specifier) {
            let Ok(path) = deno_path_util::url_to_file_path(specifier) else {
                return Ok(ResolutionMode::Require);
            };
            if let Some(pkg_json) = self.pjson.get_closest_package_json(&path)? {
                let is_file_location_cjs = pkg_json.typ != "module";
                Ok(if is_file_location_cjs || path.extension().is_none() {
                    ResolutionMode::Require
                } else {
                    ResolutionMode::Import
                })
            } else {
                Ok(ResolutionMode::Require)
            }
        } else if self.mode != IsCjsResolutionMode::Disabled {
            let Ok(path) = deno_path_util::url_to_file_path(specifier) else {
                return Ok(ResolutionMode::Import);
            };
            if let Some(pkg_json) = self.pjson.get_closest_package_json(&path)? {
                let is_cjs_type = pkg_json.typ == "commonjs"
                    || self.mode == IsCjsResolutionMode::ImplicitTypeCommonJs
                        && pkg_json.typ == "none";
                Ok(if is_cjs_type {
                    ResolutionMode::Require
                } else {
                    ResolutionMode::Import
                })
            } else if self.mode == IsCjsResolutionMode::ImplicitTypeCommonJs {
                Ok(ResolutionMode::Require)
            } else {
                Ok(ResolutionMode::Import)
            }
        } else {
            Ok(ResolutionMode::Import)
        }
    }

    /// Returns true if the given specifier is a `CommonJS` module
    /// based on the package.json of the module or the specifier itself
    ///
    /// Used to transpile `CommonJS` modules to ES modules
    pub fn is_cjs(
        &self,
        specifier: &ModuleSpecifier,
        media_type: MediaType,
        is_script: bool,
    ) -> bool {
        if specifier.scheme() != "file" {
            return false;
        }

        match media_type {
            MediaType::Wasm
            | MediaType::Json
            | MediaType::Mts
            | MediaType::Mjs
            | MediaType::Dmts => false,

            MediaType::Cjs | MediaType::Cts | MediaType::Dcts => true,

            MediaType::Dts => {
                // dts files are always determined based on the package.json because
                // they contain imports/exports even when considered CJS
                if let Some(value) = self.get_known_is_cjs(specifier) {
                    value
                } else {
                    let value = self.check_based_on_pkg_json(specifier).ok();
                    if let Some(value) = value {
                        self.set_is_cjs(specifier, value == ResolutionMode::Require);
                    }
                    value.unwrap_or(ResolutionMode::Require) == ResolutionMode::Require
                }
            }

            MediaType::JavaScript
            | MediaType::Jsx
            | MediaType::TypeScript
            | MediaType::Tsx
            | MediaType::Css
            | MediaType::SourceMap
            | MediaType::Unknown => {
                if let Some(value) = self.get_known_is_cjs(specifier) {
                    if value && !is_script {
                        // we now know this is actually esm
                        self.set_is_cjs(specifier, false);
                        false
                    } else {
                        value
                    }
                } else if !is_script {
                    // we now know this is esm
                    self.set_is_cjs(specifier, false);
                    false
                } else {
                    let value = self.check_based_on_pkg_json(specifier).ok();
                    if let Some(value) = value {
                        self.set_is_cjs(specifier, value == ResolutionMode::Require);
                    }
                    value.unwrap_or(ResolutionMode::Require) == ResolutionMode::Require
                }
            }
        }
    }

    /// Returns true if a `node_modules` directory exists in the base directory
    /// and is a directory.
    #[must_use]
    pub fn has_node_modules_dir(&self) -> bool {
        self.root_node_modules_dir
            .as_ref()
            .is_some_and(|d| self.fs.exists_sync(d) && self.fs.is_dir_sync(d))
    }

    /// Returns the filesystem implementation used by the resolver
    #[must_use]
    pub fn filesystem(&self) -> Arc<dyn FileSystem + Send + Sync> {
        self.fs.clone()
    }

    /// Initializes the services required by the resolver
    #[must_use]
    pub fn init_services(
        self: &Arc<Self>,
    ) -> NodeExtInitServices<RustyResolver, RustyResolver, RealSys> {
        NodeExtInitServices {
            node_require_loader: Rc::new(self.require_loader.clone()),
            pkg_json_resolver: self.pjson.clone(),
            node_resolver: Arc::new(self.node_resolver()),
            sys: RealSys::default(),
        }
    }

    fn fs_env(fs: Arc<dyn FileSystem + Send + Sync>) -> RealSys {
        RealSys::clone(fs)
    }
}

impl InNpmPackageChecker for RustyResolver {
    fn in_npm_package(&self, specifier: &url::Url) -> bool {
        let is_file = specifier.scheme() == "file";

        let path = specifier.path().to_ascii_lowercase();
        let in_node_modules = path.contains("/node_modules/");
        let is_polyfill = path.contains("/node:");

        is_file && (in_node_modules || is_polyfill)
    }
}

impl NpmPackageFolderResolver for RustyResolver {
    fn resolve_package_folder_from_package(
        &self,
        specifier: &str,
        referrer: &UrlOrPathRef,
    ) -> Result<PathBuf, node_resolver::errors::PackageFolderResolveError> {
        let request = PackageReq::from_str(specifier).map_err(|_| {
            let e = Box::new(PackageFolderResolveErrorKind::PackageNotFound(
                PackageNotFoundError {
                    package_name: specifier.to_string(),
                    referrer: referrer.display(),
                    referrer_extra: None,
                },
            ));
            node_resolver::errors::PackageFolderResolveError(e)
        })?;

        let p = self
            .byonm
            .resolve_pkg_folder_from_deno_module_req(&request, referrer.url().unwrap());
        match p {
            Ok(p) => Ok(p),
            Err(_) => self
                .byonm
                .resolve_package_folder_from_package(specifier, referrer),
        }
    }
}

/// State provided to the process via an environment variable.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NpmProcessState {
    pub kind: NpmProcessStateKind,
    pub local_node_modules_path: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum NpmProcessStateKind {
    Byonm,
}
impl NpmProcessStateProvider for RustyResolver {
    fn get_npm_process_state(&self) -> String {
        let modules_path = self
            .root_node_modules_dir
            .as_ref()
            .map(|p| p.to_string_lossy().to_string());
        let state = NpmProcessState {
            kind: NpmProcessStateKind::Byonm,
            local_node_modules_path: modules_path,
        };
        deno_core::serde_json::to_string(&state).unwrap_or_default()
    }
}

#[derive(Debug)]
struct RequireLoader(Arc<dyn FileSystem + Send + Sync>);
impl NodeRequireLoader for RequireLoader {
    fn load_text_file_lossy(
        &self,
        path: &Path,
    ) -> Result<Cow<'static, str>, deno_error::JsErrorBox> {
        let media_type = MediaType::from_path(path);
        let text = self
            .0
            .read_text_file_lossy_sync(path, None)
            .map_err(deno_error::JsErrorBox::from_err)?;
        Ok(text)
    }

    fn ensure_read_permission<'a>(
        &self,
        permissions: &mut dyn NodePermissions,
        path: &'a Path,
    ) -> Result<std::borrow::Cow<'a, Path>, deno_error::JsErrorBox> {
        let is_in_node_modules = path
            .components()
            .all(|c| c.as_os_str().to_ascii_lowercase() != NODE_MODULES_DIR);
        if is_in_node_modules {
            // TODO: Update to JsErrorBox
            permissions
                .check_read_path(path)
                .map_err(deno_error::JsErrorBox::from_err)
        } else {
            Ok(Cow::Borrowed(path))
        }
    }

    fn is_maybe_cjs(&self, specifier: &reqwest::Url) -> Result<bool, ClosestPkgJsonError> {
        if specifier.scheme() != "file" {
            return Ok(false);
        }

        match MediaType::from_specifier(specifier) {
            MediaType::Wasm
            | MediaType::Json
            | MediaType::Mts
            | MediaType::Mjs
            | MediaType::Dmts => Ok(false),

            _ => Ok(true),
        }
    }
}
impl Clone for RequireLoader {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}
