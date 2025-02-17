use deno_core::error::JsError;
use deno_error::JsErrorBox;
use deno_runtime::deno_core::{self, serde_json::map};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("core error: {0}")]
    CoreError(String),

    #[error("runtime error: {0}")]
    Runtime(String),

    #[error("{0} could not be found in global, or module exports")]
    ValueNotFound(String),

    /// Triggers when a module times out before finishing
    #[error("Module timed out: {0}")]
    Timeout(String),

    /// Triggers when a string could not be encoded for v8
    #[error("{0} could not be encoded as a v8 value")]
    V8Encoding(String),

    /// Triggers when a module could not be loaded from the filesystem
    #[error("{0}")]
    ModuleNotFound(String),

    #[error("{0}")]
    ModuleResolutionError(String),

    /// Triggers when the heap (via `max_heap_size`) is exhausted during execution
    #[error("Heap exhausted")]
    HeapExhausted,
}

macro_rules! map_error {
    ($source_error:path, $impl:expr) => {
        impl From<$source_error> for Error {
            fn from(e: $source_error) -> Self {
                let fmt: &dyn Fn($source_error) -> Self = &$impl;
                fmt(e)
            }
        }
    };
}

map_error!(JsErrorBox, |e| Error::Runtime(e.to_string()));
map_error!(JsError, |e| Error::Runtime(format!(
    "{}\n{}",
    e.message.unwrap_or("".to_string()).to_string(), e.stack.unwrap_or("".to_string()).to_string()
)));
map_error!(std::io::Error, |e| Error::Runtime(e.to_string()));
map_error!(deno_core::error::CoreError, |e| Error::CoreError(
    e.to_string()
));
map_error!(deno_core::ModuleResolutionError, |e| Error::Runtime(
    e.to_string()
));
map_error!(tokio::time::error::Elapsed, |e| {
    Error::Timeout(e.to_string())
});
map_error!(tokio::task::JoinError, |e| {
    Error::Timeout(e.to_string())
});
map_error!(deno_core::futures::channel::oneshot::Canceled, |e| {
    Error::Timeout(e.to_string())
});

impl From<Error> for JsErrorBox {
    fn from(value: Error) -> Self {
        match value {
            Error::CoreError(e) => deno_error::JsErrorBox::generic(e),
            Error::Runtime(e) => JsErrorBox::generic(format!("Runtime error: {}", e)),
            Error::ValueNotFound(e) => JsErrorBox::type_error(format!("TypeError: {}", e)),
            Error::HeapExhausted => JsErrorBox::generic("Heap exhausted".to_string()),
            Error::ModuleNotFound(e) => JsErrorBox::generic(format!("ModuleNotFound error: {}", e)),
            Error::ModuleResolutionError(e) => {
                JsErrorBox::generic(format!("ModuleResolutionError: {}", e))
            }
            Error::V8Encoding(e) => JsErrorBox::generic(format!("V8Encoding error: {}", e)),
            Error::Timeout(e) => JsErrorBox::generic(format!("Timeout error: {}", e)),
        }
    }
}
