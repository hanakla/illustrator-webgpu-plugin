// Copyright 2025 AI Deno authors. MIT license.
// Copyright (c) 2022 Richard Carson

use deno_ast::{MediaType, ModuleExportsAndReExports, ModuleSpecifier, ParsedSource};
use deno_error::JsErrorBox;
use deno_resolver::{cjs::CjsTracker, npm::DenoInNpmPackageChecker};
use deno_runtime::deno_fs;
use node_resolver::analyze::EsmAnalysisMode;
use node_resolver::analyze::{CjsAnalysis, CjsAnalysisExports};
use serde::Deserialize;
use serde::Serialize;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use sys_traits::impls::RealSys;

use crate::deno_println;

use super::cache_db::CacheDBHash;
use super::npm_package_manager::NpmPackageManager;

#[derive(Clone)]
pub struct AiDenoCjsCodeAnalyzer {
    cjs_tracker: Arc<CjsTracker<NpmPackageManager, RealSys>>,
    fs: deno_fs::FileSystemRc,
    cjs_analysis_cache: NodeAnalysisCache,
    parsed_source_cache: Option<Arc<ParsedSourceCache>>,
}

impl AiDenoCjsCodeAnalyzer {
    pub fn new(
        fs: deno_fs::FileSystemRc,
        cjs_tracker: CjsTracker<NpmPackageManager, RealSys>,
    ) -> Self {
        Self {
            fs,
            cjs_tracker: Arc::new(cjs_tracker),
            cjs_analysis_cache: NodeAnalysisCache::new(),
            parsed_source_cache: Some(Arc::new(ParsedSourceCache::default())),
        }
    }

    pub fn analyze_cjs<'b>(
        &self,
        specifier: &ModuleSpecifier,
        source: Cow<'b, str>,
    ) -> Result<CjsAnalysis<'b>, JsErrorBox> {
        let analysis = self.inner_cjs_analysis(specifier, &source)?;

        deno_println!("analyze_cjs: {:?}", analysis);

        match analysis {
            CliCjsAnalysis::Esm => Ok(CjsAnalysis::<'b>::Esm(source, None)),
            CliCjsAnalysis::EsmAnalysis(ex) => Ok(CjsAnalysis::Esm(
                source,
                Some(CjsAnalysisExports {
                    exports: ex.exports,
                    reexports: ex.reexports,
                }),
            )),
            CliCjsAnalysis::Cjs(ex) => {
                println!(
                    "cjs analysis: exports: {:?}, reexports: {:?}",
                    ex.exports, ex.reexports
                );
                Ok(CjsAnalysis::Cjs(CjsAnalysisExports {
                    exports: ex.exports,
                    reexports: ex.reexports,
                }))
            }
        }
    }

    fn inner_cjs_analysis<'a>(
        &self,
        specifier: &ModuleSpecifier,
        source: &Cow<'a, str>,
    ) -> Result<CliCjsAnalysis, JsErrorBox> {
        let source_hash = CacheDBHash::from_hashable(source);
        if let Some(analysis) = self
            .cjs_analysis_cache
            .get_cjs_analysis(specifier.as_str(), source_hash)
        {
            return Ok(analysis);
        }

        let media_type = MediaType::from_specifier(specifier);
        if media_type == MediaType::Json {
            return Ok(CliCjsAnalysis::Cjs(ModuleExportsAndReExports {
                exports: vec![],
                reexports: vec![],
            }));
        }

        let cjs_tracker = self.cjs_tracker.clone();
        let is_maybe_cjs = cjs_tracker
            .is_maybe_cjs(specifier, media_type)
            .map_err(JsErrorBox::from_err)?;
        let analysis = if is_maybe_cjs {
            let maybe_parsed_source = self
                .parsed_source_cache
                .as_ref()
                .and_then(|c| c.remove_parsed_source(specifier));

            let specifier = specifier.clone();
            let cloned_source: Arc<str> = source.clone().into();

            let source = maybe_parsed_source
                .map(Ok)
                .unwrap_or_else(|| {
                    deno_ast::parse_program(deno_ast::ParseParams {
                        specifier,
                        text: cloned_source,
                        media_type,
                        capture_tokens: true,
                        scope_analysis: false,
                        maybe_syntax: None,
                    })
                })
                .map_err(JsErrorBox::from_err)?;
            let is_script = source.compute_is_script();
            let is_cjs = cjs_tracker
                .is_cjs_with_known_is_script(source.specifier(), media_type, is_script)
                .map_err(JsErrorBox::from_err)?;
            if is_cjs {
                let analysis = source.analyze_cjs();

                CliCjsAnalysis::Cjs(ModuleExportsAndReExports {
                    exports: analysis.exports,
                    reexports: analysis.reexports,
                })
            } else {
                CliCjsAnalysis::Esm
            }
        } else {
            CliCjsAnalysis::Esm
        };

        self.cjs_analysis_cache
            .set_cjs_analysis(specifier.as_str(), source_hash, &analysis);

        Ok(analysis)
    }
}

#[async_trait::async_trait(?Send)]
impl node_resolver::analyze::CjsCodeAnalyzer for AiDenoCjsCodeAnalyzer {
    async fn analyze_cjs<'b>(
        &self,
        specifier: &ModuleSpecifier,
        source: Option<Cow<'b, str>>,
        esm_analysis_mode: EsmAnalysisMode,
    ) -> Result<CjsAnalysis<'b>, JsErrorBox> {
        let source = match source {
            Some(source) => source,
            None => {
                if let Ok(path) = specifier.to_file_path() {
                    if let Ok(source_from_file) = self
                        .fs
                        .read_text_file_lossy_async(deno_permissions::CheckedPathBuf::unsafe_new(path))
                        .await
                    {
                        source_from_file
                    } else {
                        return Ok(CjsAnalysis::Cjs(CjsAnalysisExports {
                            exports: vec![],
                            reexports: vec![],
                        }));
                    }
                } else {
                    return Ok(CjsAnalysis::Cjs(CjsAnalysisExports {
                        exports: vec![],
                        reexports: vec![],
                    }));
                }
            }
        };

        self.analyze_cjs(specifier, source)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CliCjsAnalysis {
    /// The module was found to be an ES module.
    Esm,
    /// The module was found to be an ES module and
    /// it was analyzed for imports and exports.
    EsmAnalysis(ModuleExportsAndReExports),
    /// The module was CJS.
    Cjs(ModuleExportsAndReExports),
}

#[derive(Clone)]
pub struct NodeAnalysisCache {
    cache: Arc<Mutex<HashMap<(String, CacheDBHash), CliCjsAnalysis>>>,
}

impl NodeAnalysisCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_cjs_analysis(
        &self,
        specifier: &str,
        expected_source_hash: CacheDBHash,
    ) -> Option<CliCjsAnalysis> {
        let inner = self.cache.lock().unwrap();
        inner
            .get(&(specifier.to_string(), expected_source_hash))
            .cloned()
    }

    pub fn set_cjs_analysis(
        &self,
        specifier: &str,
        source_hash: CacheDBHash,
        cjs_analysis: &CliCjsAnalysis,
    ) {
        let mut inner = self.cache.lock().unwrap();
        inner.insert((specifier.to_string(), source_hash), cjs_analysis.clone());
    }
}

#[derive(Debug, Default)]
pub struct ParsedSourceCache {
    sources: Mutex<HashMap<ModuleSpecifier, ParsedSource>>,
}

/// It's ok that this is racy since in non-LSP situations
/// this will only ever store one form of a parsed source
/// and in LSP settings the concurrency will be enforced
/// at a higher level to ensure this will have the latest
/// parsed source.
impl ParsedSourceCache {
    fn set_parsed_source(
        &self,
        specifier: ModuleSpecifier,
        parsed_source: ParsedSource,
    ) -> Option<ParsedSource> {
        self.sources
            .lock()
            .unwrap()
            .insert(specifier, parsed_source)
    }

    fn get_parsed_source(&self, specifier: &ModuleSpecifier) -> Option<ParsedSource> {
        self.sources.lock().unwrap().get(specifier).cloned()
    }

    pub fn remove_parsed_source(&self, specifier: &ModuleSpecifier) -> Option<ParsedSource> {
        self.sources.lock().unwrap().remove(specifier)
    }

    fn get_scope_analysis_parsed_source(
        &self,
        specifier: &ModuleSpecifier,
    ) -> Option<ParsedSource> {
        let mut sources = self.sources.lock().unwrap();
        let parsed_source = sources.get(specifier)?;
        if parsed_source.has_scope_analysis() {
            Some(parsed_source.clone())
        } else {
            // upgrade to have scope analysis
            let parsed_source = sources.remove(specifier)?;
            let parsed_source = parsed_source.into_with_scope_analysis();
            sources.insert(specifier.clone(), parsed_source.clone());
            Some(parsed_source)
        }
    }

    /// Frees the parsed source from memory.
    pub fn free(&self, specifier: &ModuleSpecifier) {
        self.sources.lock().unwrap().remove(specifier);
    }

    /// Frees all parsed sources from memory.
    pub fn free_all(&self) {
        self.sources.lock().unwrap().clear();
    }
}
