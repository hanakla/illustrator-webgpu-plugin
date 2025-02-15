use std::borrow::Cow;
use std::fs::read_to_string;
use std::path::Path;
use deno_lib::npm::NpmRegistryReadPermissionCheckerMode::Local;
use maybe_path::MaybePathBuf;
use deno_runtime::deno_core::{ModuleId, ModuleSpecifier, v8, };
use deno_runtime::deno_core::v8::{GetPropertyNamesArgs, HandleScope, KeyCollectionMode};

use crate::deno::error::Error;
use crate::deno::runtime::Runtime;
use crate::deno::traits::{ToDefinedValue, ToV8String};

#[derive(Debug, Clone)]
pub struct Module {
  filename: MaybePathBuf<'static>,
  contents: Cow<'static, str>,
}

impl Module {
  pub fn from_string(
    filename: impl AsRef<Path>,
    contents: impl ToString,
  ) -> Self {
    let filename = MaybePathBuf::Owned(filename.as_ref().to_path_buf());
    let contents = Cow::Owned(contents.to_string());

    Self { filename, contents }
  }

  pub fn import(
    filename: impl AsRef<Path>,
  ) -> Result<Self, std::io::Error>{
    let contents = read_to_string(filename.as_ref())?;

    Ok(Module::from_string(filename, contents))
  }

  pub fn specifier(&self) -> ModuleSpecifier {
    ModuleSpecifier::from_file_path(self.filename.as_ref()).unwrap()
  }

  pub fn filename(&self) -> &Path {
    self.filename.as_ref()
  }

  pub fn contents(&self) -> &str {
    &self.contents
  }

}

pub struct ModuleHandle {
  module_id: ModuleId,
  module: Module
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

  pub fn get_export_function_by_name(&mut self, runtime: &mut Runtime, name: &str) -> Result<v8::Global<v8::Function>, Error> {
    let value = self.get_value_ref(runtime, name)?;

    let mut scope = runtime.deno_runtime.handle_scope();
    let local = v8::Local::<v8::Value>::new(&mut scope, value);

    if !local.is_function() {
      return Err(Error::Runtime(format!("{} is not a function", name)));
    }

    let f: v8::Local<v8::Function> = local.try_into()?;

    Ok(v8::Global::<v8::Function>::new(&mut scope, f))
  }

  pub fn get_export_value(&self, runtime: &mut Runtime, name: &str) -> Result<v8::Global<v8::Value>, Error> {
    let module_namespace = if let Ok(namespace) = runtime.deno_runtime
      .get_module_namespace(self.module_id) {
        namespace
      } else {
      return Err(Error::Runtime(format!("Failed to get module namespace: {}", self.module_id.to_string()).to_string()))
    };

    let mut scope = runtime.deno_runtime.handle_scope();
    let module_namespace = module_namespace.open(&mut scope);
    assert!(module_namespace.is_module_namespace_object());

    let key = name.to_v8_string(&mut scope);
    let value = module_namespace.get(&mut scope, key.into());

    match value.if_defined() {
      Some(v) => Ok(v8::Global::<v8::Value>::new(&mut scope, v)),
      _ => Err(Error::Runtime(name.to_string()))
    }
  }

  pub fn get_module_exports(&self, runtime: &mut Runtime) -> Result<Vec<String>, Error> {
    let module_namespace = if let Ok(namespace) =
      runtime.deno_runtime
      .get_module_namespace(self.module_id) {
      namespace
    } else {
      return Err(Error::Runtime(self.module_id().to_string()))
    };

    let mut scope = runtime.deno_runtime.handle_scope();
    let module_namespace = module_namespace.open(&mut scope);
    assert!(module_namespace.is_module_namespace_object());

    let  Some(prop_names) = module_namespace.get_own_property_names(&mut scope, GetPropertyNamesArgs {
      mode: KeyCollectionMode::OwnOnly,
      ..Default::default()
    }) else {
      return Err(Error::Runtime("Failed to get module exports".to_string()))
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

  fn get_value_ref(&mut self, runtime: &mut Runtime, name: &str) -> Result<v8::Global<v8::Value>, Error> {
    let result = self.get_export_value(runtime, name);

    match result {
      Ok(v) => Ok(v),
      Err(_) => Err(Error::ValueNotFound(name.to_string()))
    }
  }
}