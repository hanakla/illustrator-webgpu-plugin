extern crate rustyscript;
extern crate ffi_support;
extern crate once_cell;

use std::collections::HashMap;
use std::ffi::{c_char, c_void, CStr, CString};
use std::ptr::null_mut;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use rustyscript::{json_args, ExtensionOptions, Module, ModuleHandle, Runtime, RuntimeOptions, Undefined};
use rustyscript::deno_core::_ops::RustToV8;
use rustyscript::deno_core::v8;
use rustyscript::worker::{Worker, WorkerPool};

macro_rules! opaque {
  ($name:ident) => {
    #[no_mangle]
    extern "C" pub type $name = *mut c_void;
  };
}

pub type OpaqueDenoRuntime = *mut c_void;
pub type OpaqueDenoModule = *mut c_void;

// opaque!(OpaqueDenoRuntime);
// opaque!(OpaqueDenoModule);

#[no_mangle]
#[repr(C)]
struct ArrayBufferRef {
  ptr: *mut c_void,
  len: usize,
}

#[no_mangle]
pub extern "C" fn create_runtime() -> OpaqueDenoRuntime {
  let mut runtime = Runtime::new(RuntimeOptions {
    extensions: vec![],
    ..Default::default()
  }).unwrap();

  // let a = WorkerPool::new(RuntimeOptions {
  //   ..Default::default()
  // }, 4);

  let runtime = Box::new(runtime);
  Box::into_raw(runtime) as OpaqueDenoRuntime
}

#[no_mangle]
pub extern "C" fn create_module(code: *mut c_char) -> OpaqueDenoModule {
  let module = Module::new("index.ts", c_char_to_string(code));
  let bx = Box::new(module);
  Box::into_raw(bx) as OpaqueDenoModule
}

#[no_mangle]
pub extern "C" fn execute_deno(
  runtime_ref: OpaqueDenoRuntime,
  module_ref:OpaqueDenoModule,
  // code: *mut c_char,
  image_buffer: *mut ArrayBufferRef
) -> *mut ArrayBufferRef {
  if image_buffer.is_null() {
    return null_mut();
  }

  let mut runtime = unsafe { &mut *(runtime_ref as *mut Runtime) };
  let mut module = unsafe { &mut *(module_ref as *mut Module) };

  // // let module = Module::new("index.ts", c_char_to_string(code));

  let Ok(handle) = (*runtime).load_module(&module) else {
    eprintln!("Error loading module");
    return null_mut()
  };

  let Some(entrypoint) = handle.entrypoint() else {
    eprintln!("Error loading module");
    return null_mut()
  };


  let scope = &mut runtime.deno_runtime().handle_scope();
  let entrypoint = v8::Local::<v8::Function>::new(scope, entrypoint);

  let bufferdata = unsafe {
    Vec::from_raw_parts((*image_buffer).ptr as *mut u8, (*image_buffer).len, (*image_buffer).len)
  };
  let len = unsafe { (*image_buffer).len };

  let store = v8::ArrayBuffer::new_backing_store_from_bytes(bufferdata).make_shared();
  let array_buffer = v8::ArrayBuffer::with_backing_store(scope, &store);

  let Some(image_buffer_ab) = v8::Uint8ClampedArray::new(
    scope,
    array_buffer,
    0,
    len,
  ) else {
    eprintln!("failed to allocate image_buffer");
    return null_mut()
  };

  let args = vec![image_buffer_ab.into()];
  let Some(result) = entrypoint.call(scope, entrypoint.into(), &args) else {
    let len = image_buffer_ab.byte_length();

    let result = &mut ArrayBufferRef {
      ptr: Box::into_raw(
        Box::new(image_buffer_ab.get_backing_store().unwrap().data())
      ) as *mut c_void,
      len,
    };

    return result
  };

  return null_mut()




  // runtime.tokio_runtime().block_on(async {
  //
  //
  //
  //
  //
  //   // handle.entrypoint(). .
  //   // runtime.call_entrypoint_async::<Undefined>(&handle.unwrap(), json_args!(vec![1, 2, 3,])).await;
  // })


  // runtime.tokio_runtime().block_on(async {
  //   runtime.load_module_async(&module).await;
  // })


  // runtime.call_entrypoint(&module, )

  // Runtime::execute_module::<()>(&module, vec![], RuntimeOptions {
  //   ..Default::default()
  // }, json_args!());

    // let mut runtime = Runtime::new(RuntimeOptions{
    //     default_entrypoint: Some("deno".to_string()),
    //     ..Default::default()
    // }).unwrap();
    //
    //
    // let module = Module::new("test.ts", "
    //     export function deno() {
    //         return \"Hello Deno!\";
    //     }
    // ");
    // let module_handle = runtime.load_module(&module).unwrap();
    //
    // let result = runtime.call_entrypoint::<String>(&module_handle, json_args!(1)).unwrap();
    // CString::new(result).unwrap().into_raw()
}

fn c_char_to_string(c_char: *mut c_char) -> String {
    unsafe {
        CStr::from_ptr(c_char).to_string_lossy().into_owned()
    }
}