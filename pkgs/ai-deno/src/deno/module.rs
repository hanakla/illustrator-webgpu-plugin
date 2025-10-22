use deno_error::JsErrorBox;
use deno_lib::npm::NpmRegistryReadPermissionCheckerMode::Local;
use deno_runtime::deno_core::v8::{GetPropertyNamesArgs, HandleScope, KeyCollectionMode};
use deno_runtime::deno_core::{self, v8, ModuleId, ModuleSpecifier};
use maybe_path::MaybePathBuf;
use std::borrow::Cow;
use std::fmt::Display;
use std::fs::read_to_string;
use std::path::Path;

use crate::deno::error::Error;
use crate::deno::runtime::Runtime;
use crate::deno::traits::{ToDefinedValue, ToV8String};
use crate::deno_println;

#[derive(Debug, Clone)]
pub struct Module {
    filename: MaybePathBuf<'static>,
    contents: Cow<'static, str>,
}

impl Module {
    pub fn from_string(filename: impl AsRef<Path>, contents: impl ToString) -> Self {
        let filename = MaybePathBuf::Owned(filename.as_ref().to_path_buf());
        let contents = Cow::Owned(contents.to_string());

        Self { filename, contents }
    }

    pub fn import(filename: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let contents = read_to_string(filename.as_ref())?;

        Ok(Module::from_string(filename, contents))
    }

    pub fn specifier(&self, base: &Path) -> Result<ModuleSpecifier, Error> {
        resolve_path(self.filename(), base).or_else(|e| Err(Error::ModuleNotFound(e.to_string())))
    }

    pub fn filename(&self) -> &Path {
        self.filename.as_ref()
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }
}

impl Display for Module {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Module {{ filename: {:?}, contents: {:?} }}",
            self.filename, self.contents
        )
    }
}

/// Converts a string representing a relative or absolute path into a
/// `ModuleSpecifier`. A relative path is considered relative to the passed
/// `current_dir`.
///
/// This is a patch for the str only `deno_core` provided version
fn resolve_path(
    path_str: impl AsRef<Path>,
    current_dir: &Path,
) -> Result<ModuleSpecifier, JsErrorBox> {
    use std::borrow::Cow;
    let path = current_dir.join(path_str);
    let path = deno_core::normalize_path(Cow::Borrowed(path.as_path()));
    deno_core::url::Url::from_file_path(path.as_ref()).map_err(|()| {
        JsErrorBox::generic(format!(
            "Failed to resolve path: {}",
            path.to_string_lossy().to_string()
        ))
    })
}

pub trait ToModuleSpecifier {
    fn to_module_specifier(&self, base: &Path) -> Result<ModuleSpecifier, JsErrorBox>;
}

impl<T: AsRef<Path>> ToModuleSpecifier for T {
    fn to_module_specifier(&self, base: &Path) -> Result<ModuleSpecifier, JsErrorBox> {
        Ok(resolve_path(self, base)?)
    }
}

pub struct ModuleHandle {
    module_id: ModuleId,
    module: Module,
}

impl ModuleHandle {
    pub(crate) fn new(module: Module, module_id: ModuleId) -> Self {
        Self { module, module_id }
    }

    pub fn module_id(&self) -> ModuleId {
        self.module_id
    }

    pub fn module(&self) -> &Module {
        &self.module
    }

    pub fn get_export_function_by_name(
        &mut self,
        runtime: &mut Runtime,
        name: &str,
    ) -> Result<v8::Global<v8::Function>, Error> {
        let value = self.get_value_ref(runtime, name)?;

        let deno_runtime = runtime.deno_runtime();
        let context = deno_runtime.main_context();
        let isolate = deno_runtime.v8_isolate();
        v8::scope!(handle_scope, isolate);
        let context_local = v8::Local::new(handle_scope, context);
        let mut scope = v8::ContextScope::new(handle_scope, context_local);
        let local = v8::Local::<v8::Value>::new(&mut scope, value);

        if !local.is_function() {
            return Err(Error::Runtime(format!("{} is not a function", name)));
        }

        let f: v8::Local<v8::Function> = local
            .try_into()
            .or::<Error>(Err(Error::Runtime(format!("{} is not a function", name))))?;

        Ok(v8::Global::<v8::Function>::new(&mut scope, f))
    }

    pub fn get_export_value(
        &self,
        runtime: &mut Runtime,
        name: &str,
    ) -> Result<v8::Global<v8::Value>, Error> {
        let module_namespace =
            if let Ok(namespace) = runtime.deno_runtime().get_module_namespace(self.module_id) {
                namespace
            } else {
                return Err(Error::Runtime(
                    format!(
                        "Failed to get module namespace: {}",
                        self.module_id.to_string()
                    )
                    .to_string(),
                ));
            };

        let deno_runtime = runtime.deno_runtime();
        let context = deno_runtime.main_context();
        let isolate = deno_runtime.v8_isolate();
        v8::scope!(handle_scope, isolate);
        let context_local = v8::Local::new(handle_scope, context);
        let mut scope = v8::ContextScope::new(handle_scope, context_local);
        let module_namespace = module_namespace.open(&mut scope);
        assert!(module_namespace.is_module_namespace_object());

        let key = v8::String::new(&scope, name)
            .ok_or_else(|| Error::V8Encoding(name.to_string()))?
            .cast::<v8::Value>();
        let value = module_namespace.get(&mut scope, key);

        match value.if_defined() {
            Some(v) => Ok(v8::Global::<v8::Value>::new(&mut scope, v)),
            _ => Err(Error::Runtime(name.to_string())),
        }
    }

    pub fn get_module_exports(&self, runtime: &mut Runtime) -> Result<Vec<String>, Error> {
        println!("[DEBUG] get_module_exports: trying to get namespace for module_id: {}", self.module_id);

        let module_namespace =
            if let Ok(namespace) = runtime.deno_runtime().get_module_namespace(self.module_id) {
                println!("[DEBUG] get_module_exports: successfully got namespace");
                namespace
            } else {
                println!("[DEBUG] get_module_exports: failed to get namespace for module_id: {}", self.module_id);
                // Try to get more information about why it failed
                eprintln!("[DEBUG] Module {} namespace not available - module may not be fully evaluated", self.module_id);
                return Err(Error::Runtime(self.module_id().to_string()));
            };

        let deno_runtime = runtime.deno_runtime();
        let context = deno_runtime.main_context();
        let isolate = deno_runtime.v8_isolate();
        v8::scope!(handle_scope, isolate);
        let context_local = v8::Local::new(handle_scope, context);
        let mut scope = v8::ContextScope::new(handle_scope, context_local);
        let module_namespace = module_namespace.open(&mut scope);
        assert!(module_namespace.is_module_namespace_object());

        let Some(prop_names) = module_namespace.get_own_property_names(
            &mut scope,
            GetPropertyNamesArgs {
                mode: KeyCollectionMode::OwnOnly,
                ..Default::default()
            },
        ) else {
            return Err(Error::Runtime("Failed to get module exports".to_string()));
        };

        let mut results: Vec<String> = vec![];
        let length = prop_names.length();
        for i in 0..length {
            if let Some(value) = prop_names.get_index(&mut scope, i) {
                if let Some(v8_str) = value.to_string(&mut scope) {
                    let rust_str = v8_str.to_rust_string_lossy(&mut scope);
                    results.push(rust_str);
                }
            }
        }

        Ok(results)
    }

    fn get_value_ref(
        &mut self,
        runtime: &mut Runtime,
        name: &str,
    ) -> Result<v8::Global<v8::Value>, Error> {
        let result = self.get_export_value(runtime, name);

        match result {
            Ok(v) => Ok(v),
            Err(_) => Err(Error::ValueNotFound(name.to_string())),
        }
    }
}
