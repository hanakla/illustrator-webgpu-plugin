extern crate ffi_support;
extern crate once_cell;
// extern crate rustyscript;

// use rustyscript::deno_core::v8;
// use rustyscript::{Module, Runtime, RuntimeOptions};
use crate::deno::deno_runtime::deno_core::error::JsError;
use crate::deno::{Module, ModuleHandle, Runtime, RuntimeInitOptions};
use deno_core::{anyhow, serde_json::json};
use deno_runtime::deno_core::v8;
use std::ffi::{c_char, c_void, CStr, CString};
use std::fmt::Display;

mod deno;
mod ext;

pub type OpaqueAiMain = *mut c_void;
pub type OpaqueDenoRuntime = *mut c_void;
pub type OpaqueDenoModule = *mut c_void;

// #[repr(C)]
// pub struct ArrayBufferRef {
//     ptr: *mut c_void,
//     len: usize,
// }

#[repr(C)]
pub struct ImageDataPayload {
    width: u32,
    height: u32,
    data_ptr: *mut c_void,
    byte_length: usize,
}

#[repr(C)]
pub struct NewFunctionResult<T> {
    pub success: bool,
    pub data: *mut T,
}

impl<T> NewFunctionResult<T> {
    pub fn failed_default() -> NewFunctionResult<T> {
        NewFunctionResult {
            success: false,
            data: std::ptr::null_mut(),
        }
    }
}

#[repr(C)]
pub struct FunctionResult {
    success: bool,
    json: *mut c_char,
}

impl Display for FunctionResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let json = unsafe { CStr::from_ptr(self.json) }.to_string_lossy();
        write!(f, "FunctionResult {}", json)
    }
}

impl FunctionResult {
    pub fn failed_default() -> FunctionResult {
        FunctionResult {
            success: false,
            json: CString::new("{}".to_string()).unwrap().into_raw(),
        }
    }
}

pub type DoLiveEffectResult = NewFunctionResult<ImageDataPayload>;

pub struct AlertPayload {}

impl AlertPayload {
    pub fn alert(message: String) -> CString {
        CString::new(
            json!({
                "kind": "alert",
                "message": message.as_str(),
            })
            .to_string(),
        )
        .unwrap()
    }
}

struct AiMain {
    pub main_runtime: Runtime,
    pub main_module: ModuleHandle,
    pub ai_alert: extern "C" fn(*const FunctionResult),
}

#[no_mangle]
pub extern "C" fn initialize(_ai_alert: extern "C" fn(*const FunctionResult)) -> OpaqueAiMain {
    // let alert_fn = move |req: &str| alert_function(req, _ai_alert);

    let mut runtime = Runtime::new(&mut RuntimeInitOptions {
        //     extensions: vec![ai_user_extension::init_ops_and_esm(AiExtOptions {
        //         alert: alert_fn,
        //     })],
        ..Default::default()
    })
    .unwrap();

    let module = Module::from_string("main.js", include_str!("./js/dist/main.mjs"));
    let handle = runtime.attach_module(&module).unwrap();

    let main = AiMain {
        main_runtime: runtime,
        main_module: handle,
        ai_alert: _ai_alert,
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

#[no_mangle]
pub extern "C" fn dispose_do_live_effect_result(result: *mut DoLiveEffectResult) {
    if result.is_null() {
        return;
    }

    unsafe {
        // if !(*result).data.is_null() {
        //     drop(Box::from_raw((*result).data));
        // }
        drop(Box::from_raw(result));
    }
}

#[no_mangle]
pub extern "C" fn get_live_effects(ai_main_ref: OpaqueAiMain) -> *mut FunctionResult {
    println!("🦕rust: get_live_effects");

    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };

    let result = execute_exported_function(ai_main, "getLiveEffects", |scope| Ok(vec![]));

    println!("🦕rust: get_live_effects result: {}", result);

    // Boxで確保して、所有権を維持する
    let boxed_result = Box::new(result);

    // ヒープに確保した結果をポインタとして返す
    Box::into_raw(boxed_result)
}

#[no_mangle]
pub extern "C" fn get_live_effect_view_tree(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
) -> *mut FunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy() }.clone();

    let result = execute_exported_function(ai_main, "getEffectViewNode", |scope| {
        let effect_id = v8::String::new(scope, effect_id.to_string().as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);
        let params = v8::String::new(scope, params.to_string().as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let args: Vec<v8::Local<v8::Value>> = vec![effect_id.into(), params.into()];
        Ok(args)
    });

    print!("get_live_effect_view_tree result: {}", result);

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

#[no_mangle]
extern "C" fn do_live_effect(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
    image_data: *mut ImageDataPayload,
) -> *mut DoLiveEffectResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy() }.clone();
    let image_data = unsafe { &mut *image_data };

    let is_new_buffer = false;
    let source_buffer_ptr = unsafe { (*image_data).data_ptr };

    println!("do_live_effect: effect_id = {}", effect_id);
    let result = execute_export_function_and_raw_return(ai_main, "doLiveEffect", |scope| {
        let effect_id = v8::String::new(scope, effect_id.to_string().as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params = v8::String::new(scope, params.to_string().as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let width = v8::Number::new(scope, image_data.width as f64);
        let height = v8::Number::new(scope, image_data.height as f64);

        let buffer = {
            let bufferdata = unsafe {
                Vec::from_raw_parts(
                    image_data.data_ptr as *mut u8,
                    image_data.byte_length,
                    image_data.byte_length,
                )
            };
            let len = image_data.byte_length;

            let store = v8::ArrayBuffer::new_backing_store_from_bytes(bufferdata).make_shared();
            let array_buffer = v8::ArrayBuffer::with_backing_store(scope, &store);

            v8::Uint8ClampedArray::new(scope, array_buffer, 0, len)
        }
        .unwrap();

        let args: Vec<v8::Local<v8::Value>> = vec![
            effect_id.into(),
            params.into(),
            width.into(),
            height.into(),
            buffer.into(),
        ];
        Ok(args)
    })
    .unwrap();

    let scope = &mut ai_main.main_runtime.deno_runtime().handle_scope();

    let obj = v8::Local::<v8::Value>::new(scope, result)
        .to_object(scope)
        .unwrap();

    let property = v8::String::new(scope, "success").unwrap();
    let width = obj
        .get(scope, property.into())
        .unwrap()
        .int32_value(scope)
        .unwrap();

    let property = v8::String::new(scope, "width").unwrap();
    let height = obj
        .get(scope, property.into())
        .unwrap()
        .int32_value(scope)
        .unwrap();

    let property = v8::String::new(scope, "data").unwrap();
    let buffer = obj.get(scope, property.into()).unwrap();
    let buffer = v8::Local::<v8::Uint8ClampedArray>::try_from(buffer).unwrap();
    let buffer = buffer.get_backing_store().unwrap();
    let len = buffer.byte_length();
    let is_new_buffer = buffer.data().unwrap().as_ptr() == source_buffer_ptr;
    println!("is_new_buffer: {}", is_new_buffer);

    let boxed = Box::new(DoLiveEffectResult {
        success: true,
        data: &mut ImageDataPayload {
            width: width as u32,
            height: height as u32,
            data_ptr: Box::into_raw(Box::new(buffer.data())) as *mut c_void,
            byte_length: len,
        },
    });

    Box::into_raw(boxed)
}

// #[no_mangle]
// pub extern "C" fn create_runtime() -> OpaqueDenoRuntime {
//     let runtime = Runtime::new(RuntimeInitOptions {
//         ..Default::default()
//     })
//     .unwrap();

//     let runtime = Box::new(runtime);
//     Box::into_raw(runtime) as OpaqueDenoRuntime
// }

// #[no_mangle]
// pub extern "C" fn create_module(filename: *mut c_char, code: *mut c_char) -> OpaqueDenoModule {
//     let module = Module::from_string(c_char_to_string(filename), c_char_to_string(code));

//     let bx = Box::new(module);
//     Box::into_raw(bx) as OpaqueDenoModule
// }

// #[no_mangle]
// pub extern "C" fn execute_deno<'a>(
//     runtime_ref: OpaqueDenoRuntime,
//     module_ref: OpaqueDenoModule,
//     // code: *mut c_char,
//     image_buffer: *mut ArrayBufferRef,
// ) -> *mut ArrayBufferRef {
//     if image_buffer.is_null() {
//         return null_mut();
//     }

//     let runtime = unsafe { &mut *(runtime_ref as *mut Runtime) };
//     let module = unsafe { &mut *(module_ref as *mut Module) };
//     println!("execute_deno: module = {:?}", module);

//     let mut handle = match runtime.attach_module(module) {
//         Ok(handle) => handle,
//         Err(e) => {
//             eprintln!("Error loading module: {}", e.to_string());
//             return null_mut();
//         }
//     };

//     let entrypoint = match handle.get_export_function_by_name(runtime, "default") {
//         Ok(entrypoint) => entrypoint,
//         Err(e) => {
//             eprintln!("Error getting entrypoint: {}", e.to_string());
//             return null_mut();
//         }
//     };

//     let scope = &mut runtime.deno_runtime().handle_scope();

//     let image_buffer_opt = {
//         let bufferdata = unsafe {
//             Vec::from_raw_parts(
//                 (*image_buffer).ptr as *mut u8,
//                 (*image_buffer).len,
//                 (*image_buffer).len,
//             )
//         };
//         let len = unsafe { (*image_buffer).len };

//         let store = v8::ArrayBuffer::new_backing_store_from_bytes(bufferdata).make_shared();
//         let array_buffer = v8::ArrayBuffer::with_backing_store(scope, &store);

//         Some(v8::Uint8ClampedArray::new(scope, array_buffer, 0, len))
//     };

//     let image_buffer_ab = image_buffer_opt.unwrap().unwrap();

//     let args = vec![image_buffer_ab.into()];
//     let entrypoint = v8::Local::<v8::Function>::new(scope, entrypoint);

//     match entrypoint.call(scope, entrypoint.into(), &args) {
//         Some(result) => {
//             let len = image_buffer_ab.byte_length();

//             let result = &mut ArrayBufferRef {
//                 ptr: Box::into_raw(Box::new(
//                     image_buffer_ab.get_backing_store().unwrap().data(),
//                 )) as *mut c_void,
//                 len,
//             };

//             result
//         }
//         None => {
//             eprintln!("Error calling module function");
//             return null_mut();
//         }
//     }
// }

fn execute_export_function_and_raw_return<'a>(
    ai_main: &mut AiMain,
    function_name: &str,
    args_factory: impl for<'b> FnOnce(
        &mut v8::HandleScope<'b>,
    ) -> Result<Vec<v8::Local<'b, v8::Value>>, anyhow::Error>,
) -> Option<v8::Global<v8::Value>> {
    // let failed_res = FunctionResult {
    //     success: false,
    //     json: CString::new("{}".to_string()).unwrap().into_raw(),
    // };

    let runtime = &mut ai_main.main_runtime;

    let fn_ref = match ai_main
        .main_module
        .get_export_function_by_name(runtime, function_name)
    {
        Ok(fn_ref) => fn_ref,
        Err(e) => {
            return None;
            // return Box::into_raw(Box::new(failed_res));
        }
    };

    let handle_scope = &mut runtime.deno_runtime().handle_scope();
    let fn_ref = v8::Local::<v8::Function>::new(handle_scope, fn_ref);

    let scope = &mut v8::TryCatch::new(handle_scope);
    let undefined = v8::undefined(scope);
    let args = args_factory(scope).unwrap();

    let result = fn_ref.call(scope, undefined.into(), &args);

    if let Some(err) = scope.exception() {
        let error = JsError::from_v8_exception(scope, err);
        println!("{:?}", error);
        // return Box::into_raw(Box::new(failed_res));
        return None;
    }

    let result = match result {
        Some(result) => result,
        None => {
            // println!("Error: function call returned None");
            // return Box::into_raw(Box::new(failed_res));
            return None;
        }
    };

    Some(v8::Global::<v8::Value>::new(scope, result))
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

fn function_result_result_factory<'a>(
    scope: &mut v8::HandleScope<'a>,
    result: v8::Local<'a, v8::Value>,
) -> Result<FunctionResult, anyhow::Error> {
    let result = v8::json::stringify(scope, result)
        .unwrap()
        .to_rust_string_lossy(scope);

    Ok(FunctionResult {
        success: true,
        json: CString::new(result).unwrap().into_raw(),
    })
}

fn c_char_to_string(c_char: *mut c_char) -> String {
    unsafe { CStr::from_ptr(c_char).to_string_lossy().into_owned() }
}
