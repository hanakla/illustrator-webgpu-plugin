extern crate cbindgen;

use std::env;
use std::path::PathBuf;

fn main() {
    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());

    // println!("cargo:rustc-link-lib=static=libai_dino");
    // println!("cargo:rustc-link-search=native={}", out_path.display());

    // println!("cargo:rerun-if-changed=src/wrapper.h");
    // println!("cargo:rerun-if-changed=src/lib.rs");

    // cc::Build::new()
    //     .cpp(true)
    //     .file("src/wrapper.cpp")
    //     .compile("libai_dino");

    let profile = env::var("PROFILE").unwrap();
    let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let config = cbindgen::Config::from_root_or_default(&crate_dir);

    cbindgen::Builder::new()
        .with_config(config)
        .with_crate(crate_dir.to_string())
        .with_language(cbindgen::Language::Cxx)
        .generate()
        .expect("Unable to generate bindings")
        .write_to_file(PathBuf::from(crate_dir.to_string()).join(format!("target/{}/includes/libai_deno.h", profile)));
}