extern crate rustyscript;
extern crate ffi_support;

use std::ffi::{c_char, CString};
use ffi_support::{rust_string_to_c, FfiStr};
use rustyscript::{json_args, Module, Runtime, RuntimeOptions};

#[no_mangle]
pub extern "C" fn execute_deno(x: i32) -> *mut c_char {
    let mut runtime = Runtime::new(RuntimeOptions{
        default_entrypoint: Some("deno".to_string()),
        ..Default::default()
    }).unwrap();


    let module = Module::new("test.ts", "
        export function deno() {
            return \"Hello Deno!\";
        }
    ");
    let module_handle = runtime.load_module(&module).unwrap();

    let result = runtime.call_entrypoint::<String>(&module_handle, json_args!(1)).unwrap();
    CString::new(result).unwrap().into_raw()
}