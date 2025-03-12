use deno_runtime::{deno_core::extension, BootstrapOptions};

extension!(
    bootstrap_deno,
    options = {
        bootstrap_options: BootstrapOptions,
    },
    state = |state, options| {
        state.put(options.bootstrap_options)
    }
);
