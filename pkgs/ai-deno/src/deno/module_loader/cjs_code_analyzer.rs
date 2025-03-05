// Copyright 2025 AI Deno authors. MIT license.
// Copyright (c) 2022 Richard Carson

use deno_ast::{MediaType, ModuleSpecifier, ParsedSource};
use deno_error::JsErrorBox;
use deno_graph::{CapturingEsParser, DefaultEsParser, EsParser, ParseOptions, ParsedSourceStore};
use deno_resolver::{cjs::CjsTracker, npm::DenoInNpmPackageChecker};
use deno_runtime::deno_fs;
use node_resolver::analyze::{CjsAnalysis, CjsAnalysisExports};
use serde::Deserialize;
use serde::Serialize;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use sys_traits::impls::RealSys;

use super::cache_db::CacheDBHash;

#[derive(Clone)]
pub struct AiDenoCjsCodeAnalyzer {
    cjs_tracker: Arc<CjsTracker<DenoInNpmPackageChecker, RealSys>>,
    fs: deno_fs::FileSystemRc,
    cjs_analysis_cache: NodeAnalysisCache,
    parsed_source_cache: Option<Arc<ParsedSourceCache>>,
}

impl AiDenoCjsCodeAnalyzer {
    pub fn new(
        fs: deno_fs::FileSystemRc,
        cjs_tracker: CjsTracker<DenoInNpmPackageChecker, RealSys>,
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

        println!("analyze_cjs: {:?}", analysis);

        match analysis {
            CliCjsAnalysis::Esm => Ok(CjsAnalysis::<'b>::Esm(source)),
            CliCjsAnalysis::Cjs { exports, reexports } => {
                println!(
                    "cjs analysis: exports: {:?}, reexports: {:?}",
                    exports, reexports
                );
                Ok(CjsAnalysis::Cjs(CjsAnalysisExports { exports, reexports }))
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
            return Ok(CliCjsAnalysis::Cjs {
                exports: vec![],
                reexports: vec![],
            });
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

                CliCjsAnalysis::Cjs {
                    exports: analysis.exports,
                    reexports: analysis.reexports,
                }
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
    ) -> Result<CjsAnalysis<'b>, JsErrorBox> {
        let source = match source {
            Some(source) => source,
            None => {
                if let Ok(path) = specifier.to_file_path() {
                    if let Ok(source_from_file) =
                        self.fs.read_text_file_lossy_async(path, None).await
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
    /// The module was CJS.
    Cjs {
        exports: Vec<String>,
        reexports: Vec<String>,
    },
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
impl deno_graph::ParsedSourceStore for ParsedSourceCache {
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

    fn remove_parsed_source(&self, specifier: &ModuleSpecifier) -> Option<ParsedSource> {
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
            let parsed_source = sources.remove(specifier).unwrap();
            let parsed_source = parsed_source.into_with_scope_analysis();
            sources.insert(specifier.clone(), parsed_source.clone());
            Some(parsed_source)
        }
    }
}

impl ParsedSourceCache {
    pub fn get_parsed_source_from_js_module(
        &self,
        module: &deno_graph::JsModule,
    ) -> Result<ParsedSource, deno_ast::ParseDiagnostic> {
        let parser = self.as_capturing_parser();
        // this will conditionally parse because it's using a CapturingEsParser
        parser.parse_program(ParseOptions {
            specifier: &module.specifier,
            source: module.source.clone(),
            media_type: module.media_type,
            scope_analysis: false,
        })
    }

    pub fn remove_or_parse_module(
        &self,
        specifier: &ModuleSpecifier,
        source: Arc<str>,
        media_type: MediaType,
    ) -> Result<ParsedSource, deno_ast::ParseDiagnostic> {
        if let Some(parsed_source) = self.remove_parsed_source(specifier) {
            if parsed_source.media_type() == media_type
                && parsed_source.text().as_ref() == source.as_ref()
            {
                // note: message used tests
                // log::debug!("Removed parsed source: {}", specifier);
                return Ok(parsed_source);
            }
        }
        let options = ParseOptions {
            specifier,
            source,
            media_type,
            scope_analysis: false,
        };
        DefaultEsParser.parse_program(options)
    }

    /// Frees the parsed source from memory.
    pub fn free(&self, specifier: &ModuleSpecifier) {
        self.sources.lock().unwrap().remove(specifier);
    }

    /// Fress all parsed sources from memory.
    pub fn free_all(&self) {
        self.sources.lock().unwrap().clear();
    }

    /// Creates a parser that will reuse a ParsedSource from the store
    /// if it exists, or else parse.
    pub fn as_capturing_parser(&self) -> CapturingEsParser {
        CapturingEsParser::new(None, self)
    }
}
