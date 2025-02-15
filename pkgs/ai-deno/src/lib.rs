extern crate ffi_support;
extern crate once_cell;
// extern crate rustyscript;

// use rustyscript::deno_core::v8;
// use rustyscript::{Module, Runtime, RuntimeOptions};
use std::ffi::{c_char, c_void, CStr};
use std::ptr::null_mut;
use deno_runtime::deno_core::v8;
use crate::deno::{Module, Runtime, RuntimeInitOptions};

mod deno;

macro_rules! opaque_ref {
    ($name:ident) => {
        pub type $name = *mut c_void;
    };
}

pub type OpaqueDenoRuntime = *mut c_void;
pub type OpaqueDenoModule = *mut c_void;

// opaque_ref!(OpaqueDenoRuntime);
// opaque_ref!(OpaqueDenoModule);

#[no_mangle]
#[repr(C)]
struct ArrayBufferRef {
    ptr: *mut c_void,
    len: usize,
}

#[no_mangle]
pub extern "C" fn create_runtime() -> OpaqueDenoRuntime {
    let mut runtime = Runtime::new(RuntimeInitOptions {
        // extensions: vec![
        //   // ext::runtime_ext::init_ops_and_esm(),
        //   // deno_runtime::shared::runtime::init_ops_and_esm(),
        // ],
        ..Default::default()
    }).unwrap();

    // let Ok(pool) = WorkerPool::new(RuntimeOptions {
    //   ..Default::default()
    // }, 4);

    let runtime = Box::new(runtime);
    Box::into_raw(runtime) as OpaqueDenoRuntime
}

#[no_mangle]
pub extern "C" fn create_module(filename: *mut c_char, code: *mut c_char) -> OpaqueDenoModule {
    let module = Module::from_string(c_char_to_string(filename), c_char_to_string(code));
    let bx = Box::new(module);
    Box::into_raw(bx) as OpaqueDenoModule
}

#[no_mangle]
pub extern "C" fn execute_deno(
    runtime_ref: OpaqueDenoRuntime,
    module_ref: OpaqueDenoModule,
    // code: *mut c_char,
    image_buffer: *mut ArrayBufferRef,
) -> *mut ArrayBufferRef {
    if image_buffer.is_null() {
        return null_mut();
    }

    let mut runtime = unsafe { &mut *(runtime_ref as *mut Runtime) };
    let mut module = unsafe { &mut *(module_ref as *mut Module) };

    // // let module = Module::new("index.ts", c_char_to_string(code));

    let Ok(handle) = (*runtime).attach_module(module) else {
        eprintln!("Error loading module");
        return null_mut();
    };


    let Ok(entrypoint) = handle.get_export_function_by_name(runtime, "default") else {
        eprintln!("Error loading module");
        return null_mut();
    };

    let scope = &mut runtime.deno_runtime.handle_scope();
    let entrypoint = v8::Local::<v8::Function>::new(scope, entrypoint);

    let bufferdata = unsafe {
        Vec::from_raw_parts(
            (*image_buffer).ptr as *mut u8,
            (*image_buffer).len,
            (*image_buffer).len,
        )
    };
    let len = unsafe { (*image_buffer).len };

    let store = v8::ArrayBuffer::new_backing_store_from_bytes(bufferdata).make_shared();
    let array_buffer = v8::ArrayBuffer::with_backing_store(scope, &store);

    let Some(image_buffer_ab) = v8::Uint8ClampedArray::new(scope, array_buffer, 0, len) else {
        eprintln!("failed to allocate image_buffer");
        return null_mut();
    };

    let args = vec![image_buffer_ab.into()];
    let Some(result) = entrypoint.call(scope, entrypoint.into(), &args) else {
        let len = image_buffer_ab.byte_length();

        let result = &mut ArrayBufferRef {
            ptr: Box::into_raw(Box::new(
                image_buffer_ab.get_backing_store().unwrap().data(),
            )) as *mut c_void,
            len,
        };

        return result;
    };

    return null_mut();
}

fn c_char_to_string(c_char: *mut c_char) -> String {
    unsafe { CStr::from_ptr(c_char).to_string_lossy().into_owned() }
}
