extern crate ffi_support;
extern crate once_cell;
// extern crate rustyscript;

// use rustyscript::deno_core::v8;
// use rustyscript::{Module, Runtime, RuntimeOptions};
use crate::deno::deno_runtime::deno_core::error::JsError;
use crate::deno::{Module, ModuleHandle, Runtime, RuntimeInitOptions};
use deno_core::{anyhow, serde_v8};
use deno_runtime::deno_core::v8;
use std::ffi::{c_char, c_void, CStr, CString};
use std::ptr::null_mut;

mod deno;

pub type OpaqueAiMain = *mut c_void;
pub type OpaqueDenoRuntime = *mut c_void;
pub type OpaqueDenoModule = *mut c_void;

#[repr(C)]
pub struct ArrayBufferRef {
    ptr: *mut c_void,
    len: usize,
}

#[repr(C)]
pub struct FunctionResult {
    success: bool,
    json: *mut c_char,
}

struct AiMain {
    pub main_runtime: Runtime,
    pub main_module: ModuleHandle,
}

#[no_mangle]
pub extern "C" fn initialize() -> OpaqueAiMain {
    let mut runtime = Runtime::new(RuntimeInitOptions {
        ..Default::default()
    })
    .unwrap();

    let module = Module::from_string("ai_main.ts", include_str!("./js/ai_main.ts"));

    let handle = runtime.attach_module(&module).unwrap();

    let main = AiMain {
        main_runtime: runtime,
        main_module: handle,
    };

    Box::into_raw(Box::new(main)) as OpaqueAiMain
}

#[no_mangle]
pub extern "C" fn dispose_function_result(result: *mut FunctionResult) {
    if result.is_null() {
        return;
    }

    unsafe {
        if !(*result).json.is_null() {
            drop(CString::from_raw((*result).json));
        }
        drop(Box::from_raw(result));
    }
}

fn execute_exported_function<'a>(
    ai_main: &mut AiMain,
    function_name: &str,
    args_factory: impl for<'b> FnOnce(
        &mut v8::HandleScope<'b>,
    ) -> Result<Vec<v8::Local<'b, v8::Value>>, anyhow::Error>,
) -> FunctionResult {
    let failed_res = FunctionResult {
        success: false,
        json: CString::new("{}".to_string()).unwrap().into_raw(),
    };

    let runtime = &mut ai_main.main_runtime;

    let fn_ref = match ai_main
        .main_module
        .get_export_function_by_name(runtime, function_name)
    {
        Ok(fn_ref) => fn_ref,
        Err(e) => {
            return failed_res;
        }
    };

    let scope = &mut runtime.deno_runtime().handle_scope();
    let fn_ref = v8::Local::<v8::Function>::new(scope, fn_ref);

    let scope = &mut v8::TryCatch::new(scope);
    let undefined = v8::undefined(scope);
    let args = args_factory(scope).unwrap();
    let result = fn_ref.call(scope, undefined.into(), &args);

    if let Some(err) = scope.exception() {
        let error = JsError::from_v8_exception(scope, err);
        println!("{:?}", error);
        return failed_res;
    }

    let result = match result {
        Some(result) => result,
        None => {
            println!("Error: function call returned None");
            return failed_res;
        }
    };

    let result = v8::json::stringify(scope, result)
        .unwrap()
        .to_rust_string_lossy(scope);

    FunctionResult {
        success: true,
        json: CString::new(result).unwrap().into_raw(),
    }
}

#[no_mangle]
pub extern "C" fn get_live_effects(ai_main_ref: OpaqueAiMain) -> *mut FunctionResult {
    println!("rust: get_live_effects");

    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let result = execute_exported_function(ai_main, "getLiveEffects", |scope| Ok(vec![]));

    Box::into_raw(Box::new(result))
}

#[no_mangle]
pub extern "C" fn get_live_effect_view_tree(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
) -> *mut FunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy() };

    let result = execute_exported_function(ai_main, "getEffectViewNode", |scope| {
        let effect_id = v8::String::new(scope, effect_id.to_string().as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params = serde_v8::to_v8(scope, &params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let args: Vec<v8::Local<v8::Value>> = vec![effect_id.into(), params.into()];
        Ok(args)
    });

    Box::into_raw(Box::new(result))
}

#[no_mangle]
pub extern "C" fn create_runtime() -> OpaqueDenoRuntime {
    let runtime = Runtime::new(RuntimeInitOptions {
        ..Default::default()
    })
    .unwrap();

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
pub extern "C" fn execute_deno<'a>(
    runtime_ref: OpaqueDenoRuntime,
    module_ref: OpaqueDenoModule,
    // code: *mut c_char,
    image_buffer: *mut ArrayBufferRef,
) -> *mut ArrayBufferRef {
    if image_buffer.is_null() {
        return null_mut();
    }

    let runtime = unsafe { &mut *(runtime_ref as *mut Runtime) };
    let module = unsafe { &mut *(module_ref as *mut Module) };
    println!("execute_deno: module = {:?}", module);

    let mut handle = match runtime.attach_module(module) {
        Ok(handle) => handle,
        Err(e) => {
            eprintln!("Error loading module: {}", e.to_string());
            return null_mut();
        }
    };

    let entrypoint = match handle.get_export_function_by_name(runtime, "default") {
        Ok(entrypoint) => entrypoint,
        Err(e) => {
            eprintln!("Error getting entrypoint: {}", e.to_string());
            return null_mut();
        }
    };

    let scope = &mut runtime.deno_runtime().handle_scope();

    let image_buffer_opt = {
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

        Some(v8::Uint8ClampedArray::new(scope, array_buffer, 0, len))
    };

    let image_buffer_ab = image_buffer_opt.unwrap().unwrap();

    let args = vec![image_buffer_ab.into()];
    let entrypoint = v8::Local::<v8::Function>::new(scope, entrypoint);

    match entrypoint.call(scope, entrypoint.into(), &args) {
        Some(result) => {
            let len = image_buffer_ab.byte_length();

            let result = &mut ArrayBufferRef {
                ptr: Box::into_raw(Box::new(
                    image_buffer_ab.get_backing_store().unwrap().data(),
                )) as *mut c_void,
                len,
            };

            result
        }
        None => {
            eprintln!("Error calling module function");
            return null_mut();
        }
    }
}

fn c_char_to_string(c_char: *mut c_char) -> String {
    unsafe { CStr::from_ptr(c_char).to_string_lossy().into_owned() }
}
