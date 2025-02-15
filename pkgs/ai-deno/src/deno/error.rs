
use thiserror::Error;
use deno_error::JsErrorBox;
use deno_runtime::deno_core::error::CoreError;

#[derive(Error, Debug)]
pub enum Error {
  #[error("core error: {0}")]
  CoreError(String),

  #[error("runtime error: {0}")]
  Runtime(String),

  #[error("{0} could not be found in global, or module exports")]
  ValueNotFound(String),

  /// Triggers when a string could not be encoded for v8
  #[error("{0} could not be encoded as a v8 value")]
  V8Encoding(String),


  /// Triggers when the heap (via `max_heap_size`) is exhausted during execution
  #[error("Heap exhausted")]
  HeapExhausted,
}

impl From<CoreError> for Error {
  fn from(value: CoreError) -> Self {
    Error::CoreError(value.to_string())
  }
}

impl From<deno_core::error::CoreError> for Error {
  fn from(value: deno_core::error::CoreError) -> Self {
    Error::CoreError(value.to_string())
  }
}

impl From<Error> for JsErrorBox {
  fn from(value: Error) -> Self {
    match  value {
      Error::CoreError(e) => deno_error::JsErrorBox::generic(e),
      Error::Runtime(e) => JsErrorBox::generic(format!("Runtime error: {}", e)),
      Error::ValueNotFound(e) => JsErrorBox::type_error(format!("TypeError: {}", e)),
      Error::HeapExhausted => JsErrorBox::generic("Heap exhausted".to_string()),
      Error::V8Encoding(e) => JsErrorBox::generic(format!("V8Encoding error: {}", e)),
    }
  }
}