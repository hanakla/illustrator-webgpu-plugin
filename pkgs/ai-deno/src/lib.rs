extern crate ffi_support;
extern crate once_cell;
// extern crate rustyscript;

// use rustyscript::deno_core::v8;
// use rustyscript::{Module, Runtime, RuntimeOptions};
use crate::deno::{Module, ModuleHandle, Runtime, RuntimeInit};

use deno_core::{anyhow, serde_json::json};
use deno_lib::util::result;
use deno_runtime::deno_core::v8;
use deno_runtime::deno_core::PollEventLoopOptions;
use ext::ai_user_extension;
use ext::AiExtOptions;
use homedir::my_home;
use std::collections::HashSet;
use std::ffi::{c_char, c_void, CStr, CString};
use std::fmt::Display;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

mod debug;
mod deno;
mod ext;

pub mod safe_chars;
pub use safe_chars::SafeString;

pub type OpaqueAiMain = *mut c_void;
pub type OpaqueDenoRuntime = *mut c_void;
pub type OpaqueDenoModule = *mut c_void;

#[repr(C)]
pub struct ImageDataPayload {
    width: u32,
    height: u32,
    data_ptr: *mut c_void,
    byte_length: usize,
}

#[repr(C)]
pub struct JsonFunctionResult {
    success: bool,
    json: *mut c_char,
}

impl Display for JsonFunctionResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let json = unsafe { CStr::from_ptr(self.json) }.to_string_lossy();
        write!(f, "FunctionResult {}", json)
    }
}

impl JsonFunctionResult {
    pub fn failed_default() -> JsonFunctionResult {
        JsonFunctionResult {
            success: false,
            json: CString::new("{}".to_string()).unwrap().into_raw(),
        }
    }
}

#[repr(C)]
pub struct DoLiveEffectResult {
    pub success: bool,
    pub data: *mut ImageDataPayload,
}

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
    pub ai_alert: extern "C" fn(*const JsonFunctionResult),
}

fn package_root_dir() -> PathBuf {
    match my_home() {
        Ok(homedir) => homedir.unwrap().join(".ai-deno"),
        Err(e) => {
            panic!("ai-deno: Failed to get home directory: {}", e.to_string());
        }
    }
}

#[no_mangle]
pub extern "C" fn initialize(_ai_alert: extern "C" fn(*const JsonFunctionResult)) -> OpaqueAiMain {
    // let alert_fn = move |req: &str| alert_function(req, _ai_alert);

    dai_println!("Initializing");

    let mut allowed_schemas = HashSet::new();
    allowed_schemas.insert("ai_deno:".to_string());

    let mut runtime = Runtime::new(RuntimeInit {
        extensions: vec![ai_user_extension::init_ops_and_esm(AiExtOptions {
            // alert: alert_fn,
        })],
        allowed_module_schemas: allowed_schemas,
        package_root_dir: package_root_dir(),
        ..Default::default()
    })
    .unwrap();

    dai_println!("Load module");
    let module = Module::from_string("main.js", include_str!("./js/dist/main.mjs"));
    // Allow to crash
    let handle = runtime.attach_module(&module).unwrap();

    let mut boxed_main = Box::new(AiMain {
        main_runtime: runtime,
        main_module: handle,
        ai_alert: _ai_alert,
    });

    execute_export_function_and_raw_return(&mut *boxed_main, "loadEffects", |scope| Ok(vec![]));

    Box::into_raw(boxed_main) as OpaqueAiMain
}

#[no_mangle]
pub extern "C" fn dispose_json_function_result(result: *mut JsonFunctionResult) {
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
pub extern "C" fn get_live_effects(ai_main_ref: OpaqueAiMain) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };

    dai_println!("✨️ get_live_effects");

    let result = execute_exported_function(ai_main, "getLiveEffects", |scope| Ok(vec![]));

    let boxed_result = Box::new(result);
    Box::into_raw(boxed_result)
}

#[no_mangle]
pub extern "C" fn get_live_effect_view_tree(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy().to_string() };

    let effect_id_clone = effect_id.clone();
    let params_clone = params.clone();

    let result = execute_exported_function(ai_main, "getEffectViewNode", move |scope| {
        let effect_id = v8::String::new(scope, effect_id_clone.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);
        let params = v8::String::new(scope, params_clone.to_string().as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let args: Vec<v8::Local<v8::Value>> = vec![effect_id.into(), params.into()];
        Ok(args)
    });

    // print!("get_live_effect_view_tree result: {}", result);

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
    let source_buffer_ptr = (*image_data).data_ptr;

    let t = Instant::now();
    dai_println!("do_live_effect: effect_id = {}", effect_id);

    let result = execute_export_function_and_raw_return(ai_main, "doLiveEffect", move |scope| {
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
    });

    let result = match result {
        Some(result) => result,
        None => {
            dai_println!("do_live_effect: error: result is None");
            return Box::into_raw(Box::new(DoLiveEffectResult {
                success: false,
                data: std::ptr::null_mut(),
            }));
        }
    };

    let deno_runtime = &mut ai_main.main_runtime.deno_runtime();
    let scope = &mut deno_runtime.handle_scope();

    let print_js_object = {
        let source = v8::String::new(scope, "(value)=>console.log(value)").unwrap();
        let script = v8::Script::compile(scope, source, None).unwrap();
        let __fn = script.run(scope).unwrap();
        let __fn = v8::Local::<v8::Function>::try_from(__fn).unwrap();
        let undefined = v8::undefined(scope);

        move |scope: &mut v8::HandleScope, value: v8::Local<v8::Value>| {
            let args = vec![value];
            __fn.call(scope, undefined.into(), &args);
        }
    };

    let result = v8::Local::<v8::Value>::new(scope, result);

    if !result.is_object() {
        return Box::into_raw(Box::new(DoLiveEffectResult {
            success: false,
            data: std::ptr::null_mut(),
        }));
    }

    let returned = (|| -> Result<DoLiveEffectResult, anyhow::Error> {
        let obj = v8::Local::<v8::Value>::try_from(result)?;
        let obj = v8::Local::<v8::Object>::try_from(obj)?;

        let property = v8::String::new(scope, "width").unwrap();
        let width = obj
            .get(scope, property.into())
            .unwrap()
            .int32_value(scope)
            .unwrap();

        let property = v8::String::new(scope, "height").unwrap();
        let height = obj
            .get(scope, property.into())
            .unwrap()
            .int32_value(scope)
            .unwrap();

        let property = v8::String::new(scope, "data").unwrap();
        let buffer = obj.get(scope, property.into()).unwrap();
        let buffer = v8::Local::<v8::Uint8ClampedArray>::try_from(buffer)?;
        let buffer = buffer.get_backing_store().unwrap();

        let len = buffer.byte_length();

        let is_new_buffer = buffer.data().unwrap().as_ptr() == source_buffer_ptr;
        dai_println!("is_new_buffer: {}", is_new_buffer);

        let data_ptr = buffer.data().unwrap().cast::<u8>().as_ptr() as *mut c_void;
        // let data_ptr = Box::into_raw(Box::new(data_ptr)) as *mut c_void;
        dai_println!("source_ptr: {:p}", source_buffer_ptr);
        dai_println!("data_ptr: {:p}", data_ptr);

        Ok(DoLiveEffectResult {
            success: true,
            data: Box::into_raw(Box::new(ImageDataPayload {
                width: width as u32,
                height: height as u32,
                data_ptr,
                byte_length: len,
            })),
        })
    })();

    dai_println!("do_live_effect: elapsed = {:?}", t.elapsed());

    match returned {
        Ok(result) => Box::into_raw(Box::new(result)),
        Err(e) => {
            eprintln!("do_live_effect: error: {}", e);
            Box::into_raw(Box::new(DoLiveEffectResult {
                success: false,
                data: std::ptr::null_mut(),
            }))
        }
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
pub extern "C" fn edit_live_effect_parameters(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };

    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy().to_string() };

    let result = execute_exported_function(ai_main, "editLiveEffectParameters", move |scope| {
        let effect_id = v8::String::new(scope, effect_id.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params = v8::String::new(scope, params.as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let args: Vec<v8::Local<v8::Value>> = vec![effect_id.into(), params.into()];
        Ok(args)
    });

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

/// Fire view event and returns normalized next parameters
#[no_mangle]
pub extern "C" fn edit_live_effect_fire_event(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    event_payload: *const c_char,
    params: *const c_char,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let event_payload = unsafe { CStr::from_ptr(event_payload).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy().to_string() };

    let result = execute_exported_function(ai_main, "editLiveEffectFireCallback", move |scope| {
        let effect_id = v8::String::new(scope, effect_id.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let event_payload = v8::String::new(scope, event_payload.as_str()).unwrap();
        let event_payload = v8::json::parse(scope, event_payload).unwrap();
        let event_payload = v8::Local::<v8::Object>::try_from(event_payload).unwrap();

        let params = v8::String::new(scope, params.as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let args: Vec<v8::Local<v8::Value>> =
            vec![effect_id.into(), event_payload.into(), params.into()];
        Ok(args)
    });

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

extern "C" {
    fn ai_deno_trampoline_adjust_color_callback(
        ptr: *mut c_void,
        color: *const SafeString,
    ) -> *mut SafeString;
}

#[no_mangle]
pub extern "C" fn live_effect_adjust_colors(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
    adjust_color_fn: *mut c_void,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy().to_string() };

    let result = execute_exported_function(ai_main, "liveEffectAdjustColors", move |scope| {
        let effect_id = v8::String::new(scope, effect_id.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params = v8::String::new(scope, params.as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let adjust_color_ptr = adjust_color_fn as *mut c_void;
        let adjust_color_ext = v8::External::new(scope, adjust_color_ptr);

        let adjust_color = v8::Function::builder(
            |scope: &mut v8::HandleScope,
             args: v8::FunctionCallbackArguments,
             mut ret: v8::ReturnValue| {
                // args[0]: ColorRGBA to json
                let color = args.get(0);
                let color = v8::json::stringify(scope, color).unwrap();
                let color = color.to_rust_string_lossy(scope);

                // Call adjust_color_fn
                let adjust_color_fn_ref = v8::Local::<v8::External>::try_from(args.data()).unwrap();
                let adjust_color_fn_ptr = unsafe { adjust_color_fn_ref.value() as *mut c_void };

                let result_json = unsafe {
                    ai_deno_trampoline_adjust_color_callback(
                        adjust_color_fn_ptr,
                        SafeString::from(color).as_ptr(),
                    )
                }
                .to_owned();
                let result_json = unsafe { *Box::from_raw(result_json) };

                // Parse json to ColorRGBA
                let result = v8::String::new(scope, result_json.as_str().unwrap()).unwrap();
                let result = v8::json::parse(scope, result).unwrap();
                let result = v8::Local::<v8::Object>::try_from(result).unwrap();

                // Set return value
                ret.set(result.into());
            },
        )
        .data(adjust_color_ext.into())
        .build(scope)
        .unwrap();

        Ok(vec![effect_id.into(), params.into(), adjust_color.into()])
        // Ok(vec![effect_id.into(), params.into()])
    });

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

#[no_mangle]
pub extern "C" fn live_effect_scale_parameters(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params: *const c_char,
    scale_factor: f64,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params).to_string_lossy().to_string() };

    let result = execute_exported_function(ai_main, "liveEffectScaleParameters", move |scope| {
        let effect_id = v8::String::new(scope, effect_id.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params = v8::String::new(scope, params.as_str()).unwrap();
        let params = v8::json::parse(scope, params).unwrap();
        let params = v8::Local::<v8::Object>::try_from(params).unwrap();

        let scale = v8::Number::new(scope, scale_factor);

        let args: Vec<v8::Local<v8::Value>> = vec![effect_id.into(), params.into(), scale.into()];
        Ok(args)
    });

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

#[no_mangle]
pub extern "C" fn live_effect_interpolate(
    ai_main_ref: OpaqueAiMain,
    effect_id: *const c_char,
    params_a: *const c_char,
    params_b: *const c_char,
    percent: f64,
) -> *mut JsonFunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };
    let effect_id = unsafe { CStr::from_ptr(effect_id).to_string_lossy().to_string() };
    let params = unsafe { CStr::from_ptr(params_a).to_string_lossy().to_string() };
    let target_params = unsafe { CStr::from_ptr(params_b).to_string_lossy().to_string() };

    let result = execute_exported_function(ai_main, "liveEffectInterpolate", move |scope| {
        let effect_id = v8::String::new(scope, effect_id.as_str()).unwrap();
        let effect_id = v8::Local::new(scope, effect_id);

        let params_a = v8::String::new(scope, params.as_str()).unwrap();
        let params_a = v8::json::parse(scope, params_a).unwrap();
        let params_a = v8::Local::<v8::Object>::try_from(params_a).unwrap();

        let target_params = v8::String::new(scope, target_params.as_str()).unwrap();
        let target_params = v8::json::parse(scope, target_params).unwrap();
        let target_params = v8::Local::<v8::Object>::try_from(target_params).unwrap();

        let percent = v8::Number::new(scope, percent);

        let args: Vec<v8::Local<v8::Value>> = vec![
            effect_id.into(),
            params_a.into(),
            target_params.into(),
            percent.into(),
        ];
        Ok(args)
    });

    let boxed = Box::new(result);

    Box::into_raw(boxed)
}

fn execute_export_function_and_raw_return<'a>(
    ai_main: &mut AiMain,
    function_name: &str,
    args_factory: impl for<'b> FnOnce(
            &mut v8::HandleScope<'b>,
        ) -> Result<Vec<v8::Local<'b, v8::Value>>, anyhow::Error>
        + 'static,
) -> Option<v8::Global<v8::Value>> {
    let tokio_runtime = ai_main.main_runtime.tokio_runtime();
    let ai_main_ptr = ai_main as *mut AiMain;
    let ai_main: &'static mut AiMain = unsafe { &mut *ai_main_ptr };

    let fn_name_arc = Arc::new(function_name.to_string());

    dai_println!("Starting execute_export_function_and_raw_return");

    // It's required for WebGPU async methods
    let localset = tokio::task::LocalSet::new();
    let result = localset.block_on(&tokio_runtime, async move {
        // It's required for WebGPU async methods
        tokio::task::spawn_local(async move {
            let runtime = &mut ai_main.main_runtime;
            let function_name = fn_name_arc.as_str();

            let fn_ref = match ai_main
                .main_module
                .get_export_function_by_name(runtime, function_name)
            {
                Ok(fn_ref) => fn_ref,
                Err(e) => return Err(anyhow::anyhow!("Error getting export function: {}", e)),
            };

            let deno_runtime = runtime.deno_runtime();

            // let fn_ref = v8::Local::<v8::Function>::new(handle_scope, fn_ref);
            let args = {
                let handle_scope = &mut deno_runtime.handle_scope();
                let args = args_factory(handle_scope).unwrap();
                args.iter()
                    .map(|v| v8::Global::new(handle_scope, *v))
                    .collect::<Vec<_>>()
            };

            dai_println!("Executing function: {}", function_name);

            let call = deno_runtime.call_with_args(&fn_ref, &args);
            let ret = tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(10)) => Err(anyhow::anyhow!("Timeout")),
                ret = deno_runtime
                .with_event_loop_promise(call, PollEventLoopOptions::default()) => Ok(ret),
            };

            dai_println!("Finished executing function: {}", function_name);

            let ret = match ret {
                Ok(ret) => ret,
                Err(e) => return Err(e),
            };

            let handle_scope = &mut deno_runtime.handle_scope();

            match ret {
                Ok(ret) => Ok(Box::new(v8::Global::<v8::Value>::new(handle_scope, ret))),
                Err(e) => Err(e.into()),
            }
        })
        .await
    });

    dai_println!("Finished execute_export_function_and_raw_return");

    match result {
        Ok(result) => match result {
            Ok(result) => Some(*result),
            Err(e) => {
                eprintln!("[deno_ai]: Error executing function: {}", e);
                None
            }
        },
        Err(e) => {
            eprintln!("[deno_ai]: JoinError {}", e);
            None
        }
    }
}

fn execute_exported_function<'a, F>(
    ai_main: &mut AiMain,
    function_name: &str,
    args_factory: F,
) -> JsonFunctionResult
where
    F: for<'b> FnOnce(
            &mut v8::HandleScope<'b>,
        ) -> Result<Vec<v8::Local<'b, v8::Value>>, anyhow::Error>
        + 'static,
{
    let failed_res = JsonFunctionResult {
        success: false,
        json: CString::new("{}".to_string()).unwrap().into_raw(),
    };

    let result = execute_export_function_and_raw_return(ai_main, function_name, args_factory);

    let result = match result {
        Some(result) => result,
        None => {
            dai_println!("Error: function call returned None");
            return failed_res;
        }
    };

    let runtime = &mut ai_main.main_runtime;
    let scope = &mut runtime.deno_runtime().handle_scope();
    let result = v8::Local::<v8::Value>::new(scope, result);
    let result = v8::json::stringify(scope, result)
        .unwrap()
        .to_rust_string_lossy(scope);

    JsonFunctionResult {
        success: true,
        json: CString::new(result).unwrap().into_raw(),
    }
}

fn c_char_to_string(c_char: *mut c_char) -> String {
    unsafe { CStr::from_ptr(c_char).to_string_lossy().into_owned() }
}
