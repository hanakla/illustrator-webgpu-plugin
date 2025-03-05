extern crate ffi_support;
extern crate once_cell;
// extern crate rustyscript;

// use rustyscript::deno_core::v8;
// use rustyscript::{Module, Runtime, RuntimeOptions};
use crate::deno::deno_runtime::deno_core::error::JsError;
use crate::deno::{Module, ModuleHandle, Runtime, RuntimeInitOptions};

use deno_core::{anyhow, serde_json::json};
use deno_runtime::deno_core::v8;
use deno_runtime::deno_core::PollEventLoopOptions;
use homedir::my_home;
use std::ffi::{c_char, c_void, CStr, CString};
use std::fmt::Display;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

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
    pub fn failed_default(message: &str) -> NewFunctionResult<T> {
        NewFunctionResult {
            success: false,
            data: json!({
                "message": message,
            })
            .to_string()
            .as_ptr() as *mut T,
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
    pub ai_alert: extern "C" fn(*const FunctionResult),
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
pub extern "C" fn initialize(_ai_alert: extern "C" fn(*const FunctionResult)) -> OpaqueAiMain {
    // let alert_fn = move |req: &str| alert_function(req, _ai_alert);

    println!("[deno_ai(rust)] Initializing");
    let mut runtime = Runtime::new(&mut RuntimeInitOptions {
        //     extensions: vec![ai_user_extension::init_ops_and_esm(AiExtOptions {
        //         alert: alert_fn,
        //     })],
        package_root_dir: package_root_dir(),
        ..Default::default()
    })
    .unwrap();

    println!("[deno_ai(rust)] Load module");
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
pub extern "C" fn get_live_effects(ai_main_ref: OpaqueAiMain) -> *mut FunctionResult {
    let ai_main = unsafe { &mut *(ai_main_ref as *mut AiMain) };

    let result = execute_exported_function(ai_main, "getLiveEffects", |scope| Ok(vec![]));

    let boxed_result = Box::new(result);
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
    println!("[deno_ai(rust)] do_live_effect: effect_id = {}", effect_id);

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
            println!("[deno_ai(rust)] do_live_effect: error: result is None");
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
        println!("[deno_ai(rust)] is_new_buffer: {}", is_new_buffer);

        let data_ptr = buffer.data().unwrap().cast::<u8>().as_ptr() as *mut c_void;
        // let data_ptr = Box::into_raw(Box::new(data_ptr)) as *mut c_void;
        println!("[deno_ai(rust)] source_ptr: {:p}", source_buffer_ptr);
        println!("[deno_ai(rust)] data_ptr: {:p}", data_ptr);

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

    println!(
        "[deno_ai(rust)] do_live_effect: elapsed = {:?}",
        t.elapsed()
    );

    match returned {
        Ok(result) => Box::into_raw(Box::new(result)),
        Err(e) => {
            eprintln!("[deno_ai(rust)] do_live_effect: error: {}", e);
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

    println!("[deno_ai(rust)] Starting execute_export_function_and_raw_return");

    // It's required for WebGPU async methods
    let localset = tokio::task::LocalSet::new();
    let result =
        localset.block_on(&tokio_runtime, async move {
            // let proc: Pin<
            //     Box<dyn Future<Output = Result<Box<v8::Global<v8::Value>>, anyhow::Error>> + 'static>,
            // > = Box::pin(

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

            println!("[deno_ai(rust)] Executing function: {}", function_name);

            let call = deno_runtime.call_with_args(&fn_ref, &args);
            let ret = tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(10)) => Err(anyhow::anyhow!("Timeout")),
                ret = deno_runtime
                .with_event_loop_promise(call, PollEventLoopOptions::default()) => Ok(ret),
            };

            println!("[deno_ai(rust)] Finished executing function: {}", function_name);

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

    println!("Finished execute_export_function_and_raw_return");

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
