use deno_error::JsErrorBox;
use deno_npm_cache::NpmCacheHttpClient;
use futures::TryFutureExt;
use reqwest::{
    header::{HeaderName, HeaderValue, IntoHeaderName},
    StatusCode,
};
use std::future::Future;
use url::Url;

#[derive(Debug, Clone)]
pub struct AiDenoHttpClient {
    client: reqwest::Client,
}

impl AiDenoHttpClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

impl AiDenoHttpClient {
    pub async fn download_with_retries_on_any_tokio_runtime(
        &self,
        url: &Url,
        maybe_headers: Option<Vec<(HeaderName, String)>>,
    ) -> Result<Option<Vec<u8>>, deno_npm_cache::DownloadError> {
        let mut headers = reqwest::header::HeaderMap::new();

        if let Some(header_list) = maybe_headers {
            header_list.iter().for_each(|(name, value)| {
                headers.insert(name, HeaderValue::from_str(value.as_str()).unwrap());
            });
        }

        retry(|| async {
            let mut url = url.clone();

            for _ in 0..5 {
                let response = self
                    .client
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
                        error: JsErrorBox::generic(format!(
                            "Failed to receive bytes: {}; {}",
                            url,
                            e.to_string()
                        )),
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
