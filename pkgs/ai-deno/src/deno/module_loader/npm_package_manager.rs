use std::collections::{HashMap, HashSet};
use std::fs::{self};
use std::future::Future;
use std::io::{self};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use deno_cache_dir::npm::NpmCacheDir;
use deno_error::JsErrorBox;
use deno_lib::version;
use deno_npm::npm_rc::{RegistryConfig, RegistryConfigWithUrl};
use deno_npm_cache::{
    NpmCache, NpmCacheHttpClient, NpmCacheSetting, RegistryInfoProvider, TarballCache,
};
use deno_package_json::{NodeModuleKind, PackageJson};
use deno_path_util::{url_from_directory_path, url_from_file_path};
use deno_resolver::npm::{ByonmInNpmPackageChecker, DenoInNpmPackageChecker};
use deno_runtime::deno_core::serde_json;
use deno_semver::package::{self, PackageNv};
use deno_semver::{StackString, Version};
use flate2::read::GzDecoder;
use futures::TryFutureExt;
use node_resolver::errors::{
    PackageFolderResolveError, PackageFolderResolveErrorKind, PackageNotFoundError,
};
use node_resolver::{
    cache, InNpmPackageChecker, NpmPackageFolderResolver, PathClean, UrlOrPathRef,
};
use reqwest::header::{HeaderName, HeaderValue};
use reqwest::StatusCode;
use serde_json::Value;
use sys_traits::impls::RealSys;
use sys_traits::{FsRead, FsWrite};
use tar::Archive;
use url::Url;

use crate::dai_println;

pub use super::npm_client::NpmPackageError;

use super::npm_client::NpmClient;

pub struct NpmPackage {
    pub name: String,
    pub version: String,
    pub content_path: PathBuf,
}

pub struct NpmPackageManager {
    pub packages_root_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub registry_info: Arc<RegistryInfoProvider<NpmClient, RealSys>>,
    pub npm_client: Arc<NpmClient>,
    npm_cache: Arc<deno_npm_cache::NpmCache<RealSys>>,
    installed_packages: HashSet<String>,
    sys: RealSys,
}

impl Clone for NpmPackageManager {
    fn clone(&self) -> Self {
        Self {
            packages_root_dir: self.packages_root_dir.clone(),
            cache_dir: self.cache_dir.clone(),
            installed_packages: self.installed_packages.clone(),
            npm_cache: Arc::new(create_npm_cache(self.packages_root_dir.clone())),
            npm_client: self.npm_client.clone(),
            registry_info: self.registry_info.clone(),
            sys: self.sys.clone(),
        }
    }
}

fn create_npm_cache(cache_dir: PathBuf) -> NpmCache<RealSys> {
    let sys = RealSys::default();

    NpmCache::new(
        Arc::new(NpmCacheDir::new(&sys, cache_dir.clone(), vec![])),
        sys,
        NpmCacheSetting::Use,
        Arc::new(create_default_npmrc()),
    )
}

fn create_default_npmrc() -> deno_npm::npm_rc::ResolvedNpmRc {
    deno_npm::npm_rc::ResolvedNpmRc {
        default_config: RegistryConfigWithUrl {
            registry_url: Url::from_str("https://registry.npmjs.org").unwrap(),
            config: Arc::new(RegistryConfig::default()),
        },
        scopes: HashMap::from([(
            "jsr".to_string(),
            RegistryConfigWithUrl {
                registry_url: Url::from_str("https://npm.jsr.io").unwrap(),
                config: Arc::new(RegistryConfig::default()),
            },
        )]),
        registry_configs: HashMap::from([]),
    }
}

impl NpmPackageManager {
    pub fn new(package_root_dir: PathBuf) -> Self {
        let cache_dir = package_root_dir.clone();
        if !cache_dir.exists() {
            std::fs::create_dir_all(&cache_dir).unwrap_or_default();
        }

        let npm_client = Arc::new(NpmClient::new());
        let npm_cache = Arc::new(create_npm_cache(cache_dir.clone()));
        let registry_info = Arc::new(RegistryInfoProvider::new(
            npm_cache.clone(),
            npm_client.clone(),
            Arc::new(create_default_npmrc()),
        ));

        // let npm_tarball_cache = TarballCache::new(
        //     Arc::clone(&npm_cache),
        //     npm_client.clone(),
        //     sys.clone(),
        //     Arc::new(default_npm_rc()),
        // );

        Self {
            packages_root_dir: package_root_dir,
            cache_dir,
            npm_client,
            registry_info,
            npm_cache,
            installed_packages: HashSet::new(),
            sys: RealSys::default(),
        }
    }

    pub fn is_package_installed(&self, name: &str, version: &str) -> bool {
        let install_key = format!("{}@{}", name, version);
        if self.installed_packages.contains(&install_key) {
            return true;
        }

        let package_dir = self.compute_package_dir(name, Some(version));
        if !package_dir.exists() {
            return false;
        }

        let package_json_path = package_dir.join("package.json");
        if !package_json_path.exists() {
            return false;
        }

        match PackageJson::load_from_path(&self.sys, None, &package_json_path) {
            Ok(pkg_json) => {
                if let Some(pkg_version) = pkg_json.version.clone() {
                    return pkg_version == version;
                } else {
                    return false;
                }
            }
            Err(_) => {
                return false;
            }
        }
    }

    fn compute_package_dir(&self, name: &str, version: Option<&str>) -> PathBuf {
        if let Some(version) = version {
            self.npm_cache.package_folder_for_nv(&PackageNv {
                name: StackString::from_str(name),
                version: Version::parse_from_npm(&version).unwrap(),
            })
        } else {
            self.npm_cache.package_name_folder(name)
        }
    }

    /// Install a package with dependencies
    pub async fn install_package_with_deps(
        &mut self,
        name: &str,
        version: &str,
        npm_client: Arc<NpmClient>,
    ) -> Result<NpmPackage, JsErrorBox> {
        dai_println!("Installing npm package: {}@{:?}", name, version);

        if !self.packages_root_dir.exists() {
            std::fs::create_dir_all(&self.packages_root_dir)
                .map_err(|e| NpmPackageError::ExtractionFailed(e.to_string()))?;
        }

        let (resolved_version, tarball_url, package_info) =
            npm_client.get_package_info(name, Some(version)).await?;

        let install_key = format!("{}@{}", name, resolved_version);

        let package_dir = self.npm_cache.package_folder_for_nv(&PackageNv {
            name: StackString::from_str(name),
            version: Version::parse_from_npm(&resolved_version).unwrap(),
        });

        dai_println!("Package directory: {}", package_dir.display());

        if self.is_package_installed(name, version) {
            dai_println!("package already installed: {}@{}", name, resolved_version);
        } else {
            if let Some(parent) = package_dir.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| NpmPackageError::ExtractionFailed(e.to_string()))?;
                }
            }

            let pkg_info = self
                .registry_info
                .package_info(name)
                .map_err(|e| NpmPackageError::ResolutionFailed(e.to_string()))
                .await?;

            self.npm_cache.save_package_info(name, &pkg_info)?;

            let tarball_bytes = npm_client
                .download_tarball(&tarball_url)
                .await
                .map_err(|e| NpmPackageError::DownloadFailed(e.to_string()))?;

            self.extract_tarball(&tarball_bytes, &package_dir)
                .map_err(|e| NpmPackageError::ExtractionFailed(e.to_string()))?;

            self.installed_packages.insert(install_key);

            // return Ok(NpmPackage {
            //     name: name.to_string(),
            //     version: resolved_version,
            //     content_path: package_dir,
            // });
        }

        let dependencies = self.extract_dependencies(&package_info)?;
        dai_println!("Dependencies: {:?}", dependencies);

        for (dep_name, dep_version) in dependencies {
            let fut = self.install_package_with_deps(&dep_name, &dep_version, npm_client.clone());
            match Box::pin(fut).await {
                Ok(_) => {
                    dai_println!("Npm package installed: {}@{}", dep_name, dep_version);
                }
                Err(e) => {
                    dai_println!(
                        "Failed to install npm package: {}@{} - {}",
                        dep_name,
                        dep_version,
                        e
                    );
                    // Continue to install other dependencies
                }
            }
        }

        Ok(NpmPackage {
            name: name.to_string(),
            version: resolved_version,
            content_path: package_dir,
        })
    }

    fn extract_dependencies(
        &self,
        package_info: &Value,
    ) -> Result<HashMap<String, String>, NpmPackageError> {
        let mut dependencies = HashMap::new();

        if let Some(deps) = package_info.get("dependencies").and_then(|d| d.as_object()) {
            for (name, version) in deps {
                if let Some(version_str) = version.as_str() {
                    dependencies.insert(name.clone(), version_str.to_string());
                }
            }
        }

        // It needs to be pre-fetched because it cannot be loaded synchronously when required
        if let Some(opt_deps) = package_info
            .get("optionalDependencies")
            .and_then(|d| d.as_object())
        {
            for (name, version) in opt_deps {
                if let Some(version_str) = version.as_str() {
                    dependencies.insert(name.clone(), version_str.to_string());
                }
            }
        }

        Ok(dependencies)
    }

    /// Resolve npm specifier to a package directory on file system
    fn resolve_specifier_to_package_dir(
        &self,
        specifier: &str,
        referrer: Option<&UrlOrPathRef>,
    ) -> Result<PathBuf, NpmPackageError> {
        let (name, version, subpath) = parse_npm_specifier(specifier)?;
        let mut version = version;

        dai_println!(
            "resolve_specifier_to_package_dir: {} v:{:?} subpath: {}",
            name,
            version,
            subpath
        );

        if version.is_none() {
            if let Some(referrer) = referrer {
                let referrer = referrer.path().unwrap();
                let pjson_path = self.resolve_closest_package_json(referrer);

                if let Some(pjson_path) = pjson_path {
                    let pjson = serde_json::from_str::<Value>(
                        self.sys
                            .fs_read_to_string_lossy(pjson_path)
                            .unwrap()
                            .to_string()
                            .as_str(),
                    )
                    .map_err(|e| NpmPackageError::ResolutionFailed(e.to_string()))?;

                    let deps: Vec<(String, String)> = pjson
                        .get("dependencies")
                        .and_then(|d| d.as_object())
                        .map(|d| {
                            d.iter()
                                .map(|(k, v)| (k.clone(), v.as_str().unwrap().to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    let opt_deps: Vec<(String, String)> = pjson
                        .get("optionalDependencies")
                        .and_then(|d| d.as_object())
                        .map(|d| {
                            d.iter()
                                .map(|(k, v)| (k.clone(), v.as_str().unwrap().to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    let all_deps = deps
                        .iter()
                        .chain(opt_deps.iter())
                        .map(|(k, v)| (k.clone(), v.clone()))
                        .collect::<Vec<(String, String)>>();

                    dai_println!("all_deps: {:?}", all_deps);

                    for (dep_name, dep_version) in all_deps {
                        let dep_ver = Version::parse_from_npm(dep_version.as_str()).unwrap();
                        if dep_name.clone() == name {
                            version = Some(dep_ver.to_string());
                            break;
                        }
                    }
                }
            }
        }

        if version.is_none() {
            dai_println!("version is none: name: {}", name);
            let pkg_info = self
                .npm_cache
                .load_package_info(name.as_str())
                .map_err(|e| NpmPackageError::ResolutionFailed(e.to_string()))?;

            if let Some(pkg_info) = pkg_info {
                let dist_tags = pkg_info.dist_tags;

                dai_println!("dist_tags: {:?}", dist_tags);
                dai_println!("latest: {:?}", dist_tags.get("latest").unwrap().to_string());

                version = Some(dist_tags.get("latest").unwrap().to_string());
            }
        }

        let version = match version {
            Some(v) => v,
            None => {
                return Err(NpmPackageError::ResolutionFailed(format!(
                    "Could not resolve npm package: {}",
                    name
                )));
            }
        };
        let package_dir = self.compute_package_dir(&name, Some(&version));

        dai_println!(
            "Package directory: {}, {}",
            package_dir.display(),
            package_dir.exists()
        );

        if !package_dir.exists() {
            return Err(NpmPackageError::ResolutionFailed(format!(
                "Could not resolve npm package: {}@{}",
                name, version
            )));
        }

        Ok(package_dir)
    }

    /// Resolve npm specifier to a file path on file system
    pub fn resolve_specifier_to_file_path(
        &self,
        specifier: &str,
        referrer: Option<&UrlOrPathRef>,
    ) -> Result<PathBuf, NpmPackageError> {
        let (name, version, sub_path) = parse_npm_specifier(specifier)?;

        dai_println!(
            "resolve_specifier_to_file_path: {} sub_path: {:?}",
            specifier,
            sub_path
        );

        let package_dir = self.resolve_specifier_to_package_dir(specifier, referrer)?;

        dai_println!(
            "package directory: {}, sub: {:?}",
            package_dir.display(),
            sub_path
        );

        let pkg_json =
            PackageJson::load_from_path(&self.sys, None, &package_dir.join("package.json"))
                .map_err(|e| NpmPackageError::ResolutionFailed(e.to_string()))?;

        dai_println!("package.json: {:?}", pkg_json);

        if sub_path.is_empty() {
            let main_field = pkg_json
                .main(NodeModuleKind::Esm)
                .or_else(|| Some("index.js"))
                .unwrap()
                .to_string();

            dai_println!("resolved entrypoint: {}", main_field);

            let main_path = package_dir.join(main_field);

            if main_path.exists() {
                return Ok(main_path);
            }

            return Err(NpmPackageError::ResolutionFailed(format!(
                "main module could not be resolved: {}",
                package_dir.display()
            )));
        }

        let file_path = package_dir.join(sub_path);

        if file_path.exists() {
            return Ok(file_path);
        }

        // if !sub_path.ends_with(".js") && !sub_path.ends_with(".json") {
        //     let js_path = package_dir.join(format!("{}.js", sub_path));
        //     if js_path.exists() {
        //         return Ok(js_path);
        //     }

        //     let index_js = package_dir.join(sub_path).join("index.js");
        //     if index_js.exists() {
        //         return Ok(index_js);
        //     }
        // }

        Err(NpmPackageError::ResolutionFailed(format!(
            "module could not be resolved: {}",
            file_path.display()
        )))
    }

    fn resolve_closest_package_json(&self, dir: &Path) -> Option<PathBuf> {
        let mut current_dir = dir.to_path_buf();

        loop {
            let package_json_path = current_dir.join("package.json");
            dai_println!("Checking package.json: {}", package_json_path.display());

            if package_json_path.exists() {
                let package_json = PackageJson::load_from_path(&self.sys, None, &package_json_path);

                if package_json.is_ok() {
                    return Some(package_json_path);
                }
            }

            if !current_dir.pop() {
                break;
            }
        }

        None
    }

    fn extract_tarball(&self, tarball_bytes: &[u8], dest_dir: &Path) -> Result<(), io::Error> {
        let temp_dir = dest_dir.with_extension("_temp");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)?;
        }
        fs::create_dir_all(&temp_dir)?;

        let tar_gz = GzDecoder::new(tarball_bytes);
        let mut archive = Archive::new(tar_gz);

        archive.set_preserve_permissions(true);
        archive.unpack(&temp_dir)?;

        let package_dir = temp_dir.join("package");

        if package_dir.exists() {
            fs::create_dir_all(dest_dir)?;

            // package/内のすべてのファイルを移動
            for entry in fs::read_dir(&package_dir)? {
                let entry = entry?;
                let path = entry.path();
                let file_name = path.file_name().unwrap();
                let dest_path = dest_dir.join(file_name);

                if path.is_dir() {
                    copy_dir_all(&path, &dest_path)?;
                } else {
                    fs::copy(&path, &dest_path)?;
                }
            }
        } else {
            if !dest_dir.exists() {
                fs::create_dir_all(dest_dir)?;
            }

            for entry in fs::read_dir(&temp_dir)? {
                let entry = entry?;
                let path = entry.path();
                let file_name = path.file_name().unwrap();
                let dest_path = dest_dir.join(file_name);

                if path.is_dir() {
                    // ディレクトリの場合は再帰的にコピー
                    copy_dir_all(&path, &dest_path)?;
                } else {
                    // ファイルの場合はコピー
                    fs::copy(&path, &dest_path)?;
                }
            }
        }

        // 一時ディレクトリを削除
        fs::remove_dir_all(temp_dir)?;

        Ok(())
    }
}

impl NpmPackageFolderResolver for NpmPackageManager {
    fn resolve_package_folder_from_package(
        &self,
        specifier: &str,
        referrer: &UrlOrPathRef,
    ) -> Result<PathBuf, PackageFolderResolveError> {
        dai_println!(
            "resolve_package_folder_from_package: specifier: {} referrer: {}",
            specifier,
            referrer.display()
        );

        let package_dir = self
            .resolve_specifier_to_package_dir(specifier, Some(referrer))
            .map_err(|e| {
                dai_println!("Error: {:?}", e);

                PackageFolderResolveError(Box::new(PackageFolderResolveErrorKind::PackageNotFound(
                    PackageNotFoundError {
                        package_name: specifier.to_string(),
                        referrer: referrer.clone().display(),
                        referrer_extra: None,
                    },
                )))
            })?;

        dai_println!("Resolved package directory: {}", package_dir.display());

        Ok(package_dir)
    }
}

impl InNpmPackageChecker for NpmPackageManager {
    fn in_npm_package(&self, specifier: &Url) -> bool {
        let specifier = specifier.as_ref();
        let packages_url = Url::from_file_path(self.packages_root_dir.clone()).unwrap();

        dai_println!(
            "in_npm_package: {}, result: {}",
            specifier,
            specifier.starts_with(packages_url.as_str())
        );

        return specifier.starts_with(packages_url.as_str());
    }

    fn in_npm_package_at_dir_path(&self, path: &Path) -> bool {
        let specifier = match url_from_directory_path(&path.to_path_buf().clean()) {
            Ok(p) => p,
            Err(_) => return false,
        };
        self.in_npm_package(&specifier)
    }

    fn in_npm_package_at_file_path(&self, path: &Path) -> bool {
        let specifier = match url_from_file_path(&path.to_path_buf().clean()) {
            Ok(p) => p,
            Err(_) => return false,
        };
        self.in_npm_package(&specifier)
    }
}

pub fn parse_npm_specifier(
    specifier: &str, // Likes "npm:lodash@4.17.21/map.js", "npm:@types/react@version"
) -> Result<(String, Option<String>, String), NpmPackageError> {
    let package_str = specifier.strip_prefix("npm:").unwrap_or(specifier);
    let pattern = r"^((?:@[^/]+/)?[^/@]+)(?:@([^/]+))?(/.*)?$";
    let regex = regex::Regex::new(pattern).unwrap();

    if let Some(captures) = regex.captures(package_str) {
        let package_name = captures.get(1).map_or("", |m| m.as_str()).to_string();
        let version = captures.get(2).map(|m| m.as_str().to_string());
        let subpath = captures.get(3).map(|m| m.as_str().to_string());

        if package_name.is_empty() {
            return Err(NpmPackageError::InvalidPackageSpec(format!(
                "Invalid package name: {}",
                specifier
            )));
        }

        Ok((
            package_name,
            version,
            subpath.or_else(|| Some("".to_string())).unwrap(),
        ))
    } else {
        Err(NpmPackageError::InvalidPackageSpec(format!(
            "Invalid npm package specifier: {}",
            specifier
        )))
    }
}

// Deno's implementation
// pub fn parse_specifier(specifier: &str) -> Option<(String, String)> {
//     let mut separator_index = specifier.find('/');
//     let mut valid_package_name = true;
//     // let mut is_scoped = false;
//     if specifier.is_empty() {
//         valid_package_name = false;
//     } else if specifier.starts_with('@') {
//         // is_scoped = true;
//         if let Some(index) = separator_index {
//             separator_index = specifier[index + 1..].find('/').map(|i| i + index + 1);
//         } else {
//             valid_package_name = false;
//         }
//     }

//     let package_name = if let Some(index) = separator_index {
//         specifier[0..index].to_string()
//     } else {
//         specifier.to_string()
//     };

//     // Package name cannot have leading . and cannot have percent-encoding or separators.
//     for ch in package_name.chars() {
//         if ch == '%' || ch == '\\' {
//             valid_package_name = false;
//             break;
//         }
//     }

//     if !valid_package_name {
//         return None;
//     }

//     let package_subpath = if let Some(index) = separator_index {
//         format!(".{}", specifier.chars().skip(index).collect::<String>())
//     } else {
//         ".".to_string()
//     };

//     Some((package_name, package_subpath))
// }

/// ディレクトリを再帰的にコピーする関数
fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), io::Error> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let path = entry.path();
        let file_name = path.file_name().unwrap();
        let dst_path = dst.join(file_name);

        if ty.is_dir() {
            copy_dir_all(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)?;
        }
    }
    Ok(())
}
