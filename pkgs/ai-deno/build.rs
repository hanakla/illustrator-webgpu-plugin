extern crate cbindgen;
extern crate deno_runtime;

// use ai_deno;

use cbindgen::Config;
// use deno_runtime::deno_core::snapshot::CreateSnapshotOptions;
// use deno_runtime::deno_core::{self, include_js_files, Extension};
use std::env;
use std::path::PathBuf;

// extension!(
//     ai_user_extension,
//     ops = [op_ai_alert, op_ai_deno_get_user_locale, op_aideno_debug_enabled],
//     esm_entry_point = "ext:ai-deno/init",
//     esm = [
//         dir "src/ext",
//         "ext:ai-deno/init" = "js/ai_extension.js",
//     ],
//     options = {
//         aiExt: AiExtOptions,
//     },
//     state = |state, options| {
//         state.put::<AiExtOptions>(options.aiExt);
//     },
// );

fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-cdylib-link-arg=-undefined");
        println!("cargo:rustc-cdylib-link-arg=dynamic_lookup");
        // println!("cargo:rustc-link-arg=-Wl,-force_load,./target/release/gn_out/obj/libai_deno.a");
    }

    #[cfg(target_os = "windows")]
    {
        println!("cargo:rustc-link-lib=ws2_32");
        println!("cargo:rustc-link-lib=iphlpapi");
        println!("cargo:rustc-link-lib=static=ai_deno");
        println!("cargo:rustc-link-lib=dylib=ai_deno");
    }

    // Make snapshot for avoid to confliction native symbols in future versions of v8
    {
        // let main_module = Extension::build("main.js")
        //     .esm(include_js_files!("src/js/dist",))
        //     .state(deno_core::JsRuntimeOptions {
        //         module_loader: Some(deno_core::deno_module_loader),
        //         ..Default::default()
        //     })
        //     .build();

        // let o = PathBuf::from(env::var_os("OUT_DIR").unwrap());
        // let snapshot_path = o.join("ai-deno-osx-snapshot.bin");

        // deno_core::snapshot::create_snapshot(CreateSnapshotOptions {
        //     cargo_manifest_dir: env::var("CARGO_MANIFEST_DIR").unwrap().as_str(),
        //     startup_snapshot: None,
        //     skip_op_registration: false,
        //     extension_transpiler: None,
        //     extensions: [],
        //     with_runtime_cb: None,
        // });
    }

    // cc::Build::new()
    //     .cpp(true)
    //     .file("src/wrapper.cpp")
    //     .compile("libai_dino");

    let profile = env::var("PROFILE").unwrap();
    let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let config = cbindgen::Config::from(Config {
        namespace: Some("ai_deno".to_string()),
        ..Default::default()
    });

    let result = cbindgen::Builder::new()
        .with_config(config)
        .with_crate(crate_dir.to_string())
        .with_language(cbindgen::Language::Cxx)
        .generate();

    match result {
        Ok(_) => {
            result.unwrap().write_to_file(
                PathBuf::from(crate_dir.to_string())
                    .join(format!("target/{}/includes/libai_deno.h", profile)),
            );
        }
        Err(e) => {
            println!("{:?}", e);
        }
    }

    // .expect("Unable to generate bindings")
}
