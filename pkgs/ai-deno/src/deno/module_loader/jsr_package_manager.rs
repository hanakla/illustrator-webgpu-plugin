use dashmap::DashMap;
use deno_ast::ModuleSpecifier;
use deno_error::JsErrorBox;
use deno_graph::packages::JsrPackageVersionInfo;
use deno_runtime::deno_core::url::Url;
use deno_semver::package::{PackageNv, PackageReq};
use deno_semver::{StackString, Version, VersionReq};
use futures::future::try_join_all;
use regex::Regex;
use reqwest::header;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;
use sys_traits::impls::RealSys;
use sys_traits::{FsCreateDirAll, FsRead, FsWrite};

use crate::dai_println;
use crate::deno::module_loader::http_client::AiDenoHttpClient;

const JSR_REGISTRY_URL: &str = "https://jsr.io";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsrPackageInfo {
    pub scope: String,
    pub name: String,
    pub latest: Version,
    pub versions: HashMap<Version, JsrPackageInfoVersion>,
}

fn is_false(v: &bool) -> bool {
    !v
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct JsrPackageInfoVersion {
    #[serde(default, skip_serializing_if = "is_false")]
    pub yanked: bool,
}

#[derive(Clone)]
pub struct JsrClient {
    client: AiDenoHttpClient,
    registry_url: String,
}

impl JsrClient {
    pub fn new() -> Self {
        let client = AiDenoHttpClient::new();
        let registry_url = JSR_REGISTRY_URL.to_string();

        Self {
            client,
            registry_url,
        }
    }

    // パッケージメタデータを取得
    pub async fn get_package_info(&self, name: &str) -> Result<JsrPackageInfo, JsErrorBox> {
        let url = Url::from_str(&format!("{}/{}/meta.json", self.registry_url, name)).unwrap();

        dai_println!("Fetching package info: {}", url);

        let response = self
            .client
            .download_with_retries_on_any_tokio_runtime(&url, None)
            .await
            .map_err(|e| JsErrorBox::generic(format!("Failed to fetch package info: {}", e)))?;

        let Some(bytes) = response else {
            return Err(JsErrorBox::generic(format!(
                "Failed to fetch package info: {}",
                url.to_string()
            )));
        };

        let info = serde_json::from_slice::<JsrPackageInfo>(&bytes)
            .map_err(|e| JsErrorBox::generic(format!("Failed to parse package info: {}", e)))?;

        Ok(info)
    }

    // バージョンメタデータを取得
    pub async fn get_package_version_info(
        &self,
        nv: &PackageNv,
    ) -> Result<JsrPackageVersionInfo, JsErrorBox> {
        let url = Url::from_str(
            format!(
                "{}/{}/{}_meta.json",
                self.registry_url, &nv.name, &nv.version
            )
            .as_str(),
        )
        .unwrap();

        dai_println!("Fetching version info: {}", url);

        let response = self
            .client
            .download_with_retries_on_any_tokio_runtime(
                &url,
                Some(vec![(header::ACCEPT, "application/json".to_string())]),
            )
            .await
            .map_err(|e| JsErrorBox::generic(format!("Failed to fetch version info: {}", e)))?;

        let info = serde_json::from_slice::<JsrPackageVersionInfo>(&response.unwrap())
            .map_err(|e| JsErrorBox::generic(format!("Failed to parse version info: {}", e)))?;

        Ok(info)
    }

    // モジュールファイルを取得
    pub async fn get_module_file(&self, nv: &PackageNv, path: &str) -> Result<Vec<u8>, JsErrorBox> {
        let url = Url::from_str(
            format!("{}/{}/{}{}", self.registry_url, &nv.name, &nv.version, path).as_str(),
        )
        .unwrap();

        dai_println!("Fetching module file: {}", url);

        let content_type = if path.ends_with(".ts") {
            "application/typescript"
        } else if path.ends_with(".js") {
            "application/javascript"
        } else if path.ends_with(".json") {
            "application/json"
        } else {
            "application/octet-stream"
        };

        let response = self
            .client
            .download_with_retries_on_any_tokio_runtime(
                &url,
                Some(vec![(header::ACCEPT, content_type.to_string())]),
            )
            .await
            .map_err(|e| JsErrorBox::generic(format!("Failed to fetch module file: {}", e)))?;

        let bytes = response.ok_or(JsErrorBox::generic(format!(
            "Failed to fetch module file: {}",
            url.to_string()
        )))?;

        Ok(bytes)
    }
}

#[derive(Clone)]
pub struct JsrPackageManager {
    pub package_root_dir: PathBuf,
    pub jsr_client: JsrClient,
    pub nv_by_req: DashMap<PackageReq, Option<PackageNv>>,
    pub info_by_nv: DashMap<PackageNv, Option<Arc<JsrPackageVersionInfo>>>,
    pub info_by_name: DashMap<String, Option<Arc<JsrPackageInfo>>>,
    pub sys: Arc<RealSys>,
}

impl JsrPackageManager {
    pub fn new(package_root_dir: PathBuf) -> Self {
        let jsr_client = JsrClient::new();
        let root_dir = package_root_dir.clone().join("jsr");

        Self {
            package_root_dir: root_dir,
            jsr_client,
            nv_by_req: DashMap::new(),
            info_by_nv: DashMap::new(),
            info_by_name: DashMap::new(),
            sys: Arc::new(RealSys::default()),
        }
    }

    pub fn compute_package_dir(&self, name: &str, version: Option<&str>) -> PathBuf {
        if let Some(version) = version {
            self.package_root_dir.join(name).join(version)
        } else {
            // self.npm_cache.package_name_folder(name)
            self.package_root_dir.join(name)
        }
    }

    // パッケージリクエストからNvへの解決
    pub async fn req_to_nv(&self, req: &PackageReq) -> Option<PackageNv> {
        if let Some(nv) = self.nv_by_req.get(req) {
            return nv.value().clone();
        }

        let maybe_get_nv = async {
            let name = req.name.clone();
            let package_info = self.package_info(&name).await?;

            // バージョン条件に一致する最初のバージョンを検索
            let mut versions = package_info.versions.iter().collect::<Vec<_>>();
            versions.sort_by_key(|(v, _)| *v);

            let version = versions
                .into_iter()
                .rev()
                .find(|(v, i)| {
                    !i.yanked && req.version_req.tag().is_none() && req.version_req.matches(v)
                })
                .map(|(v, _)| v.clone())?;

            Some(PackageNv { name, version })
        };

        let nv = maybe_get_nv.await;
        self.nv_by_req.insert(req.clone(), nv.clone());
        nv
    }

    // パッケージ情報を取得またはキャッシュから読み込み
    pub async fn package_info(&self, name: &str) -> Option<Arc<JsrPackageInfo>> {
        if let Some(info) = self.info_by_name.get(name) {
            return info.value().clone();
        }

        // キャッシュから読み込み
        let cached_info = self.get_cached_package_info(name).await;

        if let Some(info) = cached_info {
            self.info_by_name
                .insert(name.to_string(), Some(info.clone()));
            return Some(info);
        }

        let info = async {
            match self.jsr_client.get_package_info(name).await {
                Ok(info) => Some(Arc::new(info)),
                Err(e) => {
                    dai_println!("Failed to fetch package info: {}", e);
                    None
                }
            }
        }
        .await;

        self.info_by_name.insert(name.to_string(), info.clone());
        info
    }

    pub async fn get_cached_package_info(&self, name: &str) -> Option<Arc<JsrPackageInfo>> {
        let cache_dir = self.compute_package_dir(name, None);
        let cache_path = cache_dir.join("meta.json");

        if cache_path.exists() {
            match self.sys.fs_read_to_string(&cache_path) {
                Ok(content) => match serde_json::from_str::<JsrPackageInfo>(&content) {
                    Ok(info) => Some(Arc::new(info)),
                    Err(_) => None,
                },
                Err(_) => None,
            }
        } else {
            None
        }
    }

    pub async fn save_package_info(&self, info: &JsrPackageInfo) -> Result<(), JsErrorBox> {
        let cache_dir =
            self.compute_package_dir(format!("@{}/{}", &info.scope, &info.name).as_str(), None);
        let cache_path = cache_dir.join("meta.json");

        if let Ok(()) = self.sys.fs_create_dir_all(&cache_dir) {
            if let Ok(json) = serde_json::to_string_pretty(info) {
                let _ = self.sys.fs_write(&cache_path, json);
            }
        }

        Ok(())
    }

    pub async fn package_version_info(&self, nv: &PackageNv) -> Option<Arc<JsrPackageVersionInfo>> {
        if let Some(info) = self.info_by_nv.get(nv) {
            return info.value().clone();
        }

        let cached_info = self.get_cached_package_version_info(nv).await;

        if let Some(info) = cached_info {
            self.info_by_nv.insert(nv.clone(), Some(info.clone()));
            return Some(info);
        }

        let info = async {
            match self.jsr_client.get_package_version_info(nv).await {
                Ok(info) => Some(Arc::new(info)),
                Err(e) => {
                    dai_println!("Failed to fetch version info: {}", e);
                    None
                }
            }
        }
        .await;

        self.info_by_nv.insert(nv.clone(), info.clone());
        info
    }

    pub async fn get_cached_package_version_info(
        &self,
        nv: &PackageNv,
    ) -> Option<Arc<JsrPackageVersionInfo>> {
        let cache_dir = self.compute_package_dir(&nv.name, Some(nv.version.to_string().as_str()));
        let cache_path = cache_dir.join("meta.json");

        if cache_path.exists() {
            match self.sys.fs_read_to_string(&cache_path) {
                Ok(content) => match serde_json::from_str::<JsrPackageVersionInfo>(&content) {
                    Ok(info) => Some(Arc::new(info)),
                    Err(_) => None,
                },
                Err(_) => None,
            }
        } else {
            None
        }
    }

    pub async fn save_package_version_info(
        &self,
        nv: &PackageNv,
        info: &JsrPackageVersionInfo,
    ) -> Result<(), JsErrorBox> {
        let cache_dir = self.compute_package_dir(&nv.name, Some(&nv.version.to_string()));
        let cache_path = cache_dir.join("meta.json");

        if let Ok(()) = self.sys.fs_create_dir_all(&cache_dir) {
            if let Ok(json) = serde_json::to_string_pretty(info) {
                let _ = self.sys.fs_write(&cache_path, json);
            }
        }

        Ok(())
    }

    // パッケージのすべてのファイルをダウンロード
    pub async fn download_package_files(
        &self,
        nv: &PackageNv,
        version_info: &JsrPackageVersionInfo,
    ) -> Result<(), JsErrorBox> {
        let base_dir = self.compute_package_dir(&nv.name, Some(&nv.version.to_string().as_str()));

        self.sys.fs_create_dir_all(&base_dir).map_err(|e| {
            JsErrorBox::generic(format!("Failed to create package directory: {}", e))
        })?;

        let download_futures = version_info.manifest.keys().map(|file_path| {
            let file_path = file_path.clone();
            let nv = nv.clone();
            let base_dir = base_dir.clone();
            let jsr_client = self.jsr_client.clone();

            async move {
                // パスの処理（先頭の / を削除）
                let normalized_path = if file_path.starts_with('/') {
                    &file_path[1..]
                } else {
                    &file_path
                };

                let file_dir =
                    base_dir.join(Path::new(normalized_path).parent().unwrap_or(Path::new("")));

                self.sys.fs_create_dir_all(&file_dir).map_err(|e| {
                    JsErrorBox::generic(format!("Failed to create file directory: {}", e))
                })?;

                let file_content = jsr_client.get_module_file(&nv, &file_path).await?;

                let file_path = base_dir.join(normalized_path);
                self.sys
                    .fs_write(&file_path, file_content)
                    .map_err(|e| JsErrorBox::generic(format!("Failed to write file: {}", e)))?;

                Ok::<_, JsErrorBox>(())
            }
        });

        // すべてのダウンロードが完了するのを待機
        try_join_all(download_futures).await?;

        Ok(())
    }

    // パッケージが既にインストールされているか確認
    pub fn is_package_installed(&self, nv: &PackageNv) -> bool {
        let package_dir = self
            .package_root_dir
            .join("jsr")
            .join(&nv.name)
            .join(&nv.version.to_string());

        package_dir.exists() && package_dir.join("meta.json").exists()
    }

    // パッケージを解決してインストール
    pub async fn ensure_package(&self, package_req: &PackageReq) -> Result<(), JsErrorBox> {
        let nv = self.req_to_nv(package_req).await.ok_or_else(|| {
            JsErrorBox::generic(format!("Failed to resolve package: {}", package_req))
        })?;

        // パッケージがインストール済みならそのまま返す
        if self.is_package_installed(&nv) {
            return Ok(());
        }

        // バージョンメタデータを取得
        let version_info = self
            .package_version_info(&nv)
            .await
            .ok_or_else(|| JsErrorBox::generic(format!("Failed to get version info: {}", nv)))?;

        // ファイルをダウンロード
        self.download_package_files(&nv, &version_info).await?;

        if let Some(pkg_info) = self.package_info(&nv.name).await {
            self.save_package_info(pkg_info.as_ref()).await?;
        }

        self.save_package_version_info(&nv, &version_info).await?;

        Ok(())
    }

    // JSR指定子からファイルパスを解決
    pub async fn resolve_specifier_to_file_path(
        &self,
        specifier: &ModuleSpecifier,
    ) -> Result<PathBuf, JsErrorBox> {
        let (package_req, subpath) = parse_jsr_specifier(specifier.as_str())?;
        let nv = self.req_to_nv(&package_req).await.ok_or_else(|| {
            JsErrorBox::generic(format!("Failed to resolve package: {}", package_req))
        })?;

        dai_println!(
            "resolve_specifier_to_file_path: {}{}",
            package_req,
            subpath
                .clone()
                .and_then(|s| Some(format!("/{}", s.as_str())))
                .unwrap_or("".to_string())
        );

        // バージョン情報を取得
        let version_info = self
            .package_version_info(&nv)
            .await
            .ok_or_else(|| JsErrorBox::generic(format!("Failed to get version info: {}", nv)))?;

        let subpath = subpath.unwrap_or_else(|| "".to_string());
        let subpath = if subpath.is_empty() {
            ".".to_string()
        } else {
            format!(".{}", subpath).to_string()
        };

        let subpath = version_info
            .export(&subpath)
            .ok_or_else(|| JsErrorBox::generic(format!("Export not found: {}", subpath)))?
            .to_string();

        // パスの先頭の ./ を削除
        // let normalized_path = path.strip_prefix("./").unwrap_or(&path);

        let file_path = self
            .compute_package_dir(&nv.name, Some(&nv.version.to_string()))
            .join(subpath);

        if !file_path.exists() {
            return Err(JsErrorBox::generic(format!(
                "Module not found: {}",
                specifier
            )));
        }

        Ok(file_path)
    }
}

pub fn parse_jsr_specifier(specifier: &str) -> Result<(PackageReq, Option<String>), JsErrorBox> {
    let package_str = Regex::new(r"^jsr:/?")
        .unwrap()
        .replace(specifier, "")
        .to_string();

    let regex = Regex::new(r"^((?:@[^/]+/[^/@]+(?:/[^/@]+)*))(?:@([^/]+))?(/.*)?$").unwrap();

    if let Some(captures) = regex.captures(&package_str) {
        let package_name = captures.get(1).map_or("", |m| m.as_str()).to_string();
        let version = captures.get(2).map(|m| m.as_str().to_string());
        let subpath = captures.get(3).map(|m| m.as_str().to_string());

        // バージョン指定があればそれを含めてPackageReqを作成
        let package_req_str = if let Some(v) = version {
            format!("{}@{}", package_name, v)
        } else {
            package_name
        };

        // PackageReqにパース
        let package_req = PackageReq::from_str(&package_req_str).map_err(|_| {
            JsErrorBox::generic(format!(
                "Invalid JSR package specification: {}",
                package_req_str
            ))
        })?;

        Ok((package_req, subpath))
    } else {
        Err(JsErrorBox::generic(format!(
            "Invalid JSR specifier: {}",
            specifier
        )))
    }
}
