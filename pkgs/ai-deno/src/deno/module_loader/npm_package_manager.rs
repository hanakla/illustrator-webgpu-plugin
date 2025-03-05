use std::collections::{HashMap, HashSet};
use std::fs::{self};
use std::future::Future;
use std::io::{self};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use deno_cache_dir::npm::NpmCacheDir;
use deno_error::JsErrorBox;
use deno_npm::npm_rc::{RegistryConfig, RegistryConfigWithUrl};
use deno_npm_cache::{NpmCache, NpmCacheHttpClient, NpmCacheSetting, TarballCache};
use deno_package_json::{NodeModuleKind, PackageJson};
use deno_runtime::deno_core::serde_json;
use flate2::read::GzDecoder;
use futures::TryFutureExt;
use node_resolver::errors::{
    PackageFolderResolveError, PackageFolderResolveErrorKind, PackageNotFoundError,
};
use node_resolver::{cache, NpmPackageFolderResolver, UrlOrPathRef};
use reqwest::header::{HeaderName, HeaderValue};
use reqwest::StatusCode;
use serde_json::Value;
use sys_traits::impls::RealSys;
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
    pub package_root_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub npm_client: Arc<NpmClient>,
    npm_cache: Arc<deno_npm_cache::NpmCache<RealSys>>,
    installed_packages: HashSet<String>,
    sys: RealSys,
}

impl Clone for NpmPackageManager {
    fn clone(&self) -> Self {
        Self {
            package_root_dir: self.package_root_dir.clone(),
            cache_dir: self.cache_dir.clone(),
            installed_packages: self.installed_packages.clone(),
            npm_cache: Arc::new(init_npm_cache(
                self.package_root_dir.join(".deno_npm_cache"),
            )),
            sys: self.sys.clone(),
        }
    }
}

fn init_npm_cache(cache_dir: PathBuf) -> NpmCache<RealSys> {
    let sys = RealSys::default();

    NpmCache::new(
        Arc::new(NpmCacheDir::new(&sys, cache_dir.clone(), vec![])),
        sys,
        NpmCacheSetting::Use,
        Arc::new(default_npm_rc()),
    )
}

fn default_npm_rc() -> deno_npm::npm_rc::ResolvedNpmRc {
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
        let cache_dir = package_root_dir.join(".deno_npm_cache");
        if !cache_dir.exists() {
            std::fs::create_dir_all(&cache_dir).unwrap_or_default();
        }

        let sys = RealSys::default();

        let npm_client = Arc::new(NpmClient::new());

        let npm_cache = Arc::new(init_npm_cache(cache_dir.clone()));

        // let npm_tarball_cache = TarballCache::new(
        //     Arc::clone(&npm_cache),
        //     npm_client.clone(),
        //     sys.clone(),
        //     Arc::new(default_npm_rc()),
        // );

        Self {
            package_root_dir,
            cache_dir,
            npm_client,
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

        let package_dir = self.get_package_dir(name, Some(version));
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

    /// パッケージディレクトリを取得します
    pub fn get_package_dir(&self, name: &str, version: Option<&str>) -> PathBuf {
        let dir_name = if let Some(version) = version {
            if name.starts_with('@') {
                // @types/node → @types+node@version
                let normalized_name = name.replace('/', "+");
                format!("{}@{}", normalized_name, version)
            } else {
                format!("{}@{}", name, version)
            }
        } else {
            if name.starts_with('@') {
                name.replace('/', "+")
            } else {
                name.to_string()
            }
        };

        self.package_root_dir.join(dir_name)
    }

    /// Install a package with dependencies
    pub async fn install_package_with_deps(
        &mut self,
        name: &str,
        version: &str,
        npm_client: Arc<NpmClient>,
    ) -> Result<NpmPackage, NpmPackageError> {
        self.install_package_with_deps_inner(name, version, npm_client)
            .await
    }

    async fn install_package_with_deps_inner(
        &mut self,
        name: &str,
        version: &str,
        npm_client: Arc<NpmClient>,
    ) -> Result<NpmPackage, NpmPackageError> {
        println!("Installing npm package: {}@{:?}", name, version);

        if !self.package_root_dir.exists() {
            std::fs::create_dir_all(&self.package_root_dir)
                .map_err(|e| NpmPackageError::ExtractionFailed(e.to_string()))?;
        }

        let (resolved_version, tarball_url, package_info) =
            npm_client.get_package_info(name, Some(version)).await?;

        let install_key = format!("{}@{}", name, resolved_version);
        let package_dir = self.get_package_dir(name, Some(&resolved_version));

        if self.is_package_installed(name, version) {
            dai_println!("package already installed: {}", install_key);
        } else {
            if let Some(parent) = package_dir.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| NpmPackageError::ExtractionFailed(e.to_string()))?;
                }
            }

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
            let fut =
                self.install_package_with_deps_inner(&dep_name, &dep_version, npm_client.clone());
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

    /// npmパッケージ指定子をファイルシステム上のパスに解決します
    fn resolve_specifier_to_package_dir(
        &self,
        specifier: &str,
    ) -> Result<PathBuf, NpmPackageError> {
        let (name, version, subpath) = parse_npm_specifier(specifier)?;
        dai_println!(
            "resolve_specifier_to_package_dir: {} v:{:?} subpath: {}",
            name,
            version,
            subpath
        );

        if version.is_none() {
            // バージョン未指定の場合は、パッケージディレクトリを探す
            let package_dir = self.get_package_dir(&name, None);
            dai_println!("Package directory: {}", package_dir.display());

            if package_dir.exists() {
                return Ok(package_dir);
            }

            // package_root_dirの直下にあるパッケージを検索
            let entries = match std::fs::read_dir(&self.package_root_dir) {
                Ok(entries) => entries,
                Err(e) => return Err(NpmPackageError::IoError(e)),
            };

            let package_prefix = if name.starts_with('@') {
                // スコープ付きパッケージの場合 (@types/node) → @types+node@
                name.replace('/', "+") + "@"
            } else {
                // 通常のパッケージの場合 (lodash) → lodash@
                name.to_string() + "@"
            };

            // パッケージディレクトリを検索 (名前が一致するもの)
            for entry in entries {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                let file_name = entry.file_name();
                let file_name_str = match file_name.to_str() {
                    Some(s) => s,
                    None => continue,
                };

                // パッケージ名のプレフィックスでフィルタリング
                if file_name_str.starts_with(&package_prefix) {
                    return Ok(entry.path());
                }
            }

            return Err(NpmPackageError::ResolutionFailed(format!(
                "Could not resolve npm package: {}",
                name
            )));
        }

        // バージョンが指定されている場合
        let version = version.unwrap();
        let package_dir = self.get_package_dir(&name, Some(&version));

        if !package_dir.exists() {
            return Err(NpmPackageError::ResolutionFailed(format!(
                "Could not resolve npm package: {}@{}",
                name, version
            )));
        }

        Ok(package_dir)
    }

    /// npmパッケージ指定子をファイルシステム上の特定ファイルのパスに解決します
    pub fn resolve_specifier_to_file_path(
        &self,
        specifier: &str,
        sub_path: Option<&str>,
    ) -> Result<PathBuf, NpmPackageError> {
        println!(
            "resolve_specifier_to_file_path: {} sub_path: {:?}",
            specifier, sub_path
        );

        // パッケージのルートディレクトリを解決
        let package_dir = self.resolve_specifier_to_package_dir(specifier)?;

        dai_println!(
            "package directory: {}, sub: {:?}",
            package_dir.display(),
            sub_path
        );

        let pkg_json =
            PackageJson::load_from_path(&self.sys, None, &package_dir.join("package.json"))
                .map_err(|e| NpmPackageError::ResolutionFailed(e.to_string()))?;

        dai_println!("package.json: {:?}", pkg_json);

        if sub_path.is_none() || sub_path.unwrap().is_empty() {
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

        let sub_path = sub_path.unwrap();
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
            "resolve_package_folder_from_package: {} referrer: {}",
            specifier,
            referrer.display()
        );

        let package_dir = self
            .resolve_specifier_to_package_dir(specifier)
            .map_err(|op| {
                PackageFolderResolveError(Box::new(PackageFolderResolveErrorKind::PackageNotFound(
                    PackageNotFoundError {
                        package_name: specifier.to_string(),
                        referrer: referrer.clone().display(),
                        referrer_extra: None,
                    },
                )))
            })?;

        Ok(package_dir)
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
