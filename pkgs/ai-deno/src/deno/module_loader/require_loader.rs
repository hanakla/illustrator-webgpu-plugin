// The MIT License (MIT)
// Copyright (c) 2022 Richard Carson

use std::{borrow::Cow, path::Path, sync::Arc};

use deno_ast::MediaType;
use deno_core::FastString;
use deno_error::JsErrorBox;
use deno_permissions::{CheckedPath, CheckedPathBuf};
use deno_runtime::{
    deno_fs::FileSystem,
    deno_node::{self, NodeRequireLoader},
};
use node_resolver::errors::PackageJsonLoadError;

const NODE_MODULES_DIR: &str = "node_modules";

#[derive(Debug)]
pub struct AiDenoRequireLoader(pub Arc<dyn FileSystem + Send + Sync>);
impl NodeRequireLoader for AiDenoRequireLoader {
    fn load_text_file_lossy(&self, path: &Path) -> Result<FastString, JsErrorBox> {
        let checked_path = deno_permissions::CheckedPathBuf::unsafe_new(path.to_path_buf());
        let text = self
            .0
            .read_text_file_lossy_sync(&checked_path.as_checked_path())
            .map_err(|e| JsErrorBox::generic(e.to_string()))?;
        Ok(FastString::from(text.into_owned()))
    }

    fn ensure_read_permission<'a>(
        &self,
        _permissions: &mut dyn deno_node::NodePermissions,
        path: Cow<'a, Path>,
    ) -> Result<Cow<'a, Path>, JsErrorBox> {
        // let is_in_node_modules = path
        //     .components()
        //     .all(|c| c.as_os_str().to_ascii_lowercase() != NODE_MODULES_DIR);
        // if is_in_node_modules {
        //     permissions
        //         .check_read_path(path)
        //         .map_err(|e| JsErrorBox::generic(e.to_string()))
        // } else {
        Ok(path)
        // }
    }

    fn is_maybe_cjs(&self, specifier: &reqwest::Url) -> Result<bool, PackageJsonLoadError> {
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
impl Clone for AiDenoRequireLoader {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}
