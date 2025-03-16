use std::backtrace::Backtrace;

use crate::deno_println;

use super::error::Error;
use deno_ast::{MediaType, SourceMapOption};
use deno_error::JsErrorBox;
use deno_runtime::deno_core::{self, FastString, ModuleSpecifier, SourceMapData};
use deno_runtime::transpile::{JsParseDiagnostic, JsTranspileError};

pub type ModuleContents = (FastString, Option<SourceMapData>);

fn should_transpile(media_type: MediaType) -> bool {
    matches!(
        media_type,
        MediaType::Jsx
            | MediaType::TypeScript
            | MediaType::Cjs
            | MediaType::Dts
            | MediaType::Dmts
            | MediaType::Dcts
            | MediaType::Tsx
    )
}

// SEE: https://github.com/denoland/deno/blob/56f67b58511d59c5da4b62aec1dced30a17b5de4/runtime/transpile.rs#L24
pub fn transpile(filename: FastString, source: FastString) -> Result<ModuleContents, JsErrorBox> {
    deno_println!("transpile: {}", filename);

    let specifier = deno_core::url::Url::parse(&filename).unwrap();
    let mut media_type = MediaType::from_specifier(&specifier);

    if media_type == MediaType::Unknown && filename.starts_with("node:") {
        media_type = MediaType::TypeScript;
    }

    let should_transpile = should_transpile(media_type);

    if !should_transpile {
        return Ok((source, None));
    }

    let parsed = deno_ast::parse_module(deno_ast::ParseParams {
        specifier: specifier,
        text: source.into(),
        media_type,
        capture_tokens: false,
        scope_analysis: false,
        maybe_syntax: None,
    })
    .map_err(|e| JsErrorBox::from_err(JsParseDiagnostic(e)))?;

    let transpiled_source = parsed
        .transpile(
            &deno_ast::TranspileOptions {
                imports_not_used_as_values: deno_ast::ImportsNotUsedAsValues::Remove,
                ..Default::default()
            },
            &deno_ast::TranspileModuleOptions::default(),
            &deno_ast::EmitOptions {
                source_map: SourceMapOption::Separate,
                ..Default::default()
            },
        )
        .map_err(|e| JsErrorBox::from_err(JsTranspileError(e)))?
        .into_source();

    let maybe_source_map: Option<SourceMapData> = transpiled_source
        .source_map
        .map(|sm| sm.into_bytes().into());

    let source_text = transpiled_source.text;

    Ok((source_text.into(), maybe_source_map))
}
