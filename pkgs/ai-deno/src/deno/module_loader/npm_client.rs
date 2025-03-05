use std::borrow::Cow;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;

use deno_core::serde_json;
use deno_error::JsErrorBox;
use deno_npm_cache::NpmCacheHttpClient;
use futures::TryFutureExt;
use reqwest::header::{HeaderName, HeaderValue};
use reqwest::{self, StatusCode};
use serde_json::Value;
use url::Url;

#[derive(Debug, thiserror::Error)]
pub enum NpmPackageError {
    #[error("パッケージのダウンロードに失敗しました: {0}")]
    DownloadFailed(String),

    #[error("パッケージの展開に失敗しました: {0}")]
    ExtractionFailed(String),

    #[error("パッケージの解決に失敗しました: {0}")]
    ResolutionFailed(String),

    #[error("無効なパッケージ指定: {0}")]
    InvalidPackageSpec(String),

    #[error("HTTP リクエストエラー: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON パースエラー: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("I/O エラー: {0}")]
    IoError(#[from] std::io::Error),
}

impl From<NpmPackageError> for JsErrorBox {
    fn from(err: NpmPackageError) -> JsErrorBox {
        JsErrorBox::generic(err.to_string())
    }
}

pub struct NpmClient {
    pub registry_url: String,
    pub http_client: reqwest::Client,
}

impl NpmClient {
    pub fn new() -> Self {
        let registry_url = "https://registry.npmjs.org".to_string();
        let http_client = reqwest::Client::new();

        Self {
            registry_url,
            http_client,
        }
    }

    pub async fn get_package_info(
        &self,
        name: &str,
        version_req: Option<&str>,
    ) -> Result<(String, String, Value), NpmPackageError> {
        let url = if name.starts_with('@') {
            let encoded_name = name.replace('/', "%2F");
            format!("{}/{}", self.registry_url, encoded_name)
        } else {
            format!("{}/{}", self.registry_url, name)
        };

        let response = self
            .http_client
            .get(&url)
            .header("Accept", "application/vnd.npm.install-v1+json")
            .send()
            .await?
            .text()
            .await?;

        let package_info: Value = serde_json::from_str(&response)?;

        let version = if let Some(version_req) = version_req {
            version_req.to_string()
        } else if let Some(dist_tags) = package_info.get("dist-tags") {
            if let Some(latest) = dist_tags.get("latest").and_then(|v| v.as_str()) {
                latest.to_string()
            } else {
                return Err(NpmPackageError::ResolutionFailed(format!(
                    "latestタグが見つかりません: {}",
                    name
                )));
            }
        } else {
            return Err(NpmPackageError::ResolutionFailed(format!(
                "バージョン情報が見つかりません: {}",
                name
            )));
        };

        let version = if let Some(dist_tags) = package_info.get("dist-tags") {
            if let Some(resolved_version) = dist_tags.get(&version).and_then(|v| v.as_str()) {
                resolved_version.to_string()
            } else {
                version
            }
        } else {
            version
        };

        if let Some(versions) = package_info.get("versions") {
            if let Some(version_info) = versions.get(&version) {
                if let Some(dist) = version_info.get("dist") {
                    if let Some(tarball) = dist.get("tarball").and_then(|t| t.as_str()) {
                        return Ok((version, tarball.to_string(), version_info.clone()));
                    }
                }
            }
        }

        Err(NpmPackageError::ResolutionFailed(format!(
            "tarball URLが見つかりません: {}@{}",
            name, version
        )))
    }

    pub async fn download_tarball(&self, url: &str) -> Result<Vec<u8>, NpmPackageError> {
        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .map_err(|e| NpmPackageError::DownloadFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(NpmPackageError::DownloadFailed(format!(
                "HTTP status: {}",
                response.status()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| NpmPackageError::DownloadFailed(e.to_string()))?
            .to_vec();

        Ok(bytes)
    }
}

#[async_trait::async_trait(?Send)]
impl NpmCacheHttpClient for NpmClient {
    async fn download_with_retries_on_any_tokio_runtime(
        &self,
        url: Url,
        maybe_auth_header: Option<(HeaderName, HeaderValue)>,
    ) -> Result<Option<Vec<u8>>, deno_npm_cache::DownloadError> {
        let mut headers = reqwest::header::HeaderMap::new();

        if let Some((name, value)) = maybe_auth_header {
            headers.insert(name, value);
        }

        retry(|| async {
            let mut url = url.clone();

            for _ in 0..5 {
                let response = self
                    .http_client
                    .get(url.clone())
                    .headers(headers.clone())
                    .send()
                    .map_err(|e| deno_npm_cache::DownloadError {
                        status_code: None,
                        error: JsErrorBox::generic(format!("Failed to send request: {}", e)),
                    })
                    .await?;

                let status = response.status();

                if status.is_redirection() {
                    let location = response.headers().get("location").unwrap();

                    // resolve redirection from current url
                    let new_url = url.join(location.to_str().unwrap()).unwrap();
                    url = new_url;
                    continue;
                }

                if !status.is_success() {
                    return Err(deno_npm_cache::DownloadError {
                        status_code: Some(StatusCode::from_u16(status.as_u16()).unwrap()),
                        error: JsErrorBox::generic(format!("Failed to load url: {}", url)),
                    });
                }

                let bytes = response
                    .bytes()
                    .await
                    .map_err(|e| deno_npm_cache::DownloadError {
                        status_code: Some(StatusCode::from_u16(status.as_u16()).unwrap()),
                        error: JsErrorBox::generic(format!("Failed to receive bytes: {}", url)),
                    })
                    .unwrap();

                return Ok(Some(bytes.to_vec()));
            }

            Err(deno_npm_cache::DownloadError {
                status_code: None,
                error: JsErrorBox::generic("Failed to download tarball"),
            })
        })
        .await
    }
}

fn retry<F: FnMut() -> Fut, T, E, Fut: Future<Output = Result<T, E>>>(
    mut f: F,
) -> impl Future<Output = Result<T, E>> {
    async move {
        let mut last_result = None;

        for _ in 0..5 {
            let result = f().await;

            match result {
                Ok(val) => return Ok(val),
                Err(err) => {
                    last_result = Some(Err(err));
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        return last_result.unwrap();
    }
}
