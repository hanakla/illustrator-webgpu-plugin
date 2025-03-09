#[macro_export]
macro_rules! dai_println {
    () => {
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m ", file_name, line!());
        }
    };
    ($fmt:expr) => {
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), $fmt);
        }
    };
    ($fmt:expr, $($arg:tt)*) => {
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), format_args!($fmt, $($arg)*));
        }
    };
}

#[macro_export]
macro_rules! deno_println {
    () => {
        #[cfg(feature = "debug_deno")]
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m ", file_name, line!());
        }
    };
    ($fmt:expr) => {
        #[cfg(feature = "debug_deno")]
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), $fmt);
        }
    };
    ($fmt:expr, $($arg:tt)*) => {
        #[cfg(feature = "debug_deno")]
        {
            let path = std::path::Path::new(file!());
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            println!("\x1b[1m[deno_ai(rust)￤{}:{}]\x1b[0m {}", file_name, line!(), format_args!($fmt, $($arg)*));
        }
    };
}
