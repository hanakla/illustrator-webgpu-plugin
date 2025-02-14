use std::env::current_dir;
use rustyscript::{big_json_args, import, json_args, Module, Runtime, RuntimeOptions, Undefined};
// use rustyscript::{deno_core, deno_core::{extension, Extension} };

// extension!(
//   runtime_main,
//   deps = [
//     deno_webidl,
//     deno_console,
//     deno_url,
//     deno_tls,
//     deno_web,
//     deno_fetch,
//     deno_cache,
//     deno_websocket,
//     deno_webstorage,
//     deno_crypto,
//     deno_broadcast_channel,
//     deno_node,
//     deno_ffi,
//     deno_net,
//     deno_napi,
//     deno_http,
//     deno_io,
//     deno_fs,
//     rustyscript
//   ],
//   customizer = |ext: &mut Extension| {
//   {
//     use deno_core::ascii_str_include;
//     use deno_core::ExtensionFileSource;
//     ext.esm_files.to_mut().push(ExtensionFileSource::new("ext:runtime_main/js/99_main.js", ascii_str_include!("../js/99_main.js")));
//     ext.esm_entry_point = Some("ext:runtime_main/js/99_main.js");
//   }
// });


fn main() {
  // let mut runtime = Runtime::new(RuntimeOptions {
  //   extensions: vec![
  //     // runtime_main::init_ops_and_esm()
  //     // deno_os::deno_os::init_ops_and_esm(Default::default()),
  //   ],
  //   ..Default::default()
  // }).unwrap();
  //
  // // rustyscript::import("ext:runtime/98_global_scope_window.js")
  //
  let module = Module::new("index.ts", "
    // import {createCanvas} from \"npm:@napi-rs/canvas\"

    export default function deno(arg) {
      console.log(import.meta.url, arg);
      // console.log(createCanvas);
      console.log(typeof navigator);
      console.log(typeof window);
    }
  ");

  // let importModule = import(
  //   current_dir().unwrap().join("./test.ts").to_string()
  // ).unwrap();


  // (&module).



  // runtime.deno_runtime().execute_script("")

  // runtime.tokio_runtime().block_on(async {

    // let handle = runtime.load_modules_async(&module, vec![]).await;
    // let result = runtime.call_entrypoint_async::<Undefined>(&handle.unwrap(), json_args!(payload)).await;
    // let result = Runtime::execute_module::<Undefined>(&module,vec![], RuntimeOptions{
    //   default_entrypoint: Some("default".to_string()),
    //   ..Default::default()
    // }, json_args!(vec![payload]));
    //
    // match result {
    //   Ok(_) => {}
    //   Err(e) => {
    //     println!("Error: {}", e);
    //   }
    // }
    //
    // return
  // });

  // runtime.tokio_runtime().block_on(async {
  //   let handle = runtime.load_modules_async(&importModule, vec![]).await;
  //   let result = runtime.call_entrypoint_async::<Undefined>(&handle, json_args!()).await;
  // });
}