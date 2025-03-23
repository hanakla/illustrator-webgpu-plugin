#[macro_export]
macro_rules! dai_println {
    () => {
        if cfg!(feature = "debug_lib") || std::env::var("AI_DENO_DEBUG").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m ", file_name, line!());
        }
    };
    ($fmt:expr) => {
        if cfg!(feature = "debug_lib") || std::env::var("AI_DENO_DEBUG").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), $fmt);
        }
    };
    ($fmt:expr, $($arg:tt)*) => {
        if cfg!(feature = "debug_lib") || std::env::var("AI_DENO_DEBUG").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), format_args!($fmt, $($arg)*));
        }
    };
}

#[macro_export]
macro_rules! deno_println {
    () => {
        if cfg!(feature = "debug_deno") || std::env::var("AI_DENO_DEBUG_DENO").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m ", file_name, line!());
        }
    };
    ($fmt:expr) => {
        if cfg!(feature = "debug_deno") || std::env::var("AI_DENO_DEBUG_DENO").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), $fmt);
        }
    };
    ($fmt:expr, $($arg:tt)*) => {
        if cfg!(feature = "debug_deno") || std::env::var("AI_DENO_DEBUG_DENO").is_ok() {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), format_args!($fmt, $($arg)*));
        }
    };
}
