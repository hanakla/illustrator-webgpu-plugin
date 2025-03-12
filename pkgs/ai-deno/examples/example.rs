use ai_deno::{initialize, JsonFunctionResult};

use deno_core::ModuleSpecifier;
// use rustyscript::{
//     json_args, ExtensionOptions, Module, Runtime, RuntimeOptions, Undefined, WebOptions,
// };
use std::env::current_dir;
use std::mem;
use std::path::Path;
use std::ptr::null;

// include!("../src/ext/mod.rs");

fn main() {
    // println!("{}", ModuleSpecifier::parse("ai-deno:ops.js").unwrap());

    unsafe {
        let null_fn: extern "C" fn(*const JsonFunctionResult) = mem::transmute(0usize);
        initialize(null_fn);
    }

    // let tmp = current_dir().unwrap().join("ai_main.ts");
    // let entry_path = Path::new(
    //   tmp.as_os_str()
    // );
    // let main_module = ModuleSpecifier::parse("ai-deno://main_module.ts").unwrap();
    //
    // println!("{}", std::process::id());
    //
    // let mut runtime = match Runtime::new(RuntimeOptions {
    //   extensions: vec![
    //     deno_runtime::init_ops_and_esm(main_module.clone()),
    //     runtime_ext::init_ops_and_esm(),
    //   ],
    //   startup_snapshot: None,
    //   extension_options: ExtensionOptions {
    //     web: WebOptions {
    //       base_url: Some(main_module.clone()),
    //       ..Default::default()
    //     },
    //     ..Default::default()
    //   },
    //   ..Default::default()
    // }) {
    //   Ok(runtime) => runtime,
    //   Err(e) => panic!("Error: {}", e),
    // };
    //
    // let module = Module::new("ai_main.ts", "
    //   // import {createCanvas} from \"npm:@napi-rs/canvas\"
    //
    //   export default function deno(arg) {
    //     console.log(import.meta.url, arg);
    //     // console.log(createCanvas);
    //     console.log(navigator);
    //     console.log(Object.getOwnPropertyDescriptors(navigator));
    //     console.log(typeof window);
    //   }
    // ");
    //
    // runtime.tokio_runtime().block_on(async {
    //   let handle = runtime.load_modules_async(&module, vec![]).await;
    //   let result = runtime.call_entrypoint_async::<Undefined>(&handle.unwrap(), json_args!()).await;
    //
    //   match result {
    //     Ok(_) => {}
    //     Err(e) => {
    //       println!("Error: {}", e);
    //     }
    //   }
    //
    //   return
    // });
}
