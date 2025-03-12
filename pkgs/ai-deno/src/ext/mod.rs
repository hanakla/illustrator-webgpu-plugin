use deno_error::JsErrorBox;
use deno_runtime::deno_core::{extension, op2, OpState};
use serde::{Deserialize, Serialize};
use std::{cell::RefCell, rc::Rc};

pub struct AiExtOptions {
    // pub alert: fn(&str),
}

#[derive(Serialize, Deserialize)]
struct AlertRequest {
    kind: String,
    message: String,
}

extension!(
    ai_user_extension,
    ops = [op_ai_alert, op_aideno_debug_enabled],
    esm_entry_point = "ext:ai-deno/init",
    esm = [
        dir "src/ext",
        "ext:ai-deno/init" = "js/ai_extension.js",
    ],
    options = {
        aiExt: AiExtOptions,
    },
    state = |state, options| {
        state.put::<AiExtOptions>(options.aiExt);
    },
);

#[op2(fast)]
fn op_ai_alert(state: Rc<RefCell<OpState>>, #[string] message: String) -> Result<(), JsErrorBox> {
    // let request = state.borrow_mut().take::<AiExtOptions>();

    // (request.alert)(
    //     serde_json::to_string(&AlertRequest {
    //         kind: "alert".to_string(),
    //         message,
    //     })
    //     .unwrap()
    //     .as_str(),
    // );

    Ok(())
}

#[op2(fast)]
fn op_aideno_debug_enabled(state: Rc<RefCell<OpState>>) -> Result<bool, JsErrorBox> {
    if cfg!(feature = "debug_lib") {
        Ok(true)
    } else {
        Ok(false)
    }
}
