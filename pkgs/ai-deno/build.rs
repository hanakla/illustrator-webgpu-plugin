extern crate cbindgen;

use cbindgen::Config;
use std::env;
use std::path::PathBuf;

fn main() {
    // macOS用の設定
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-cdylib-link-arg=-undefined");
        println!("cargo:rustc-cdylib-link-arg=dynamic_lookup");
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
