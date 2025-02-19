# Dinostrator - A WebGPU LiveEffects for Adobe Illustrator

[Deno](https://deno.com) runs on Illustrator SDK Plugin.

## Structure

- `pkgs/ai-deno` Rust backend(library) for execute Deno runtime
- `pkgs/plugin` C++ Illustrator .aip Plugin for using ai-deno
- `sdk/` Place your downloaded Adobe Illustrator SDK.

## Building

[Note]: Currently, this project is only tested on macOS.

1. Clone this repository
2. Download [Illustrator SDK](https://developer.adobe.com/illustrator/) and copy contents to `sdk/` directory
3. Open `pkgs/ai-deno` in your shell, and run `just build`
4. Open `pkgs/plugin` in your shell, and run `just build`
5. Plugin will be generated in `pkgs/plugin/output/mac/[build]/IllustratorDeno.aip`
