use deno_core::FastString;
use deno_error::JsErrorBox;
use deno_runtime::deno_core::{extension, op2, OpState};
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::string;
use std::{cell::RefCell, rc::Rc};

use crate::ai_deno_get_user_locale;
use crate::{ai_deno_alert, dai_println};

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
    ops = [op_ai_alert, op_ai_deno_get_user_locale, op_aideno_debug_enabled],
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

    dai_println!("op_ai_alert: {}", message);

    unsafe {
        ai_deno_alert(CString::new(message).unwrap().as_ptr());
    }

    Ok(())
}

#[op2]
#[string]
fn op_ai_deno_get_user_locale(state: Rc<RefCell<OpState>>) -> String {
    let locale = unsafe {
        CStr::from_ptr(ai_deno_get_user_locale())
            .to_string_lossy()
            .to_string()
    };

    locale.to_string()
}

#[op2(fast)]
fn op_aideno_debug_enabled(state: Rc<RefCell<OpState>>) -> Result<bool, JsErrorBox> {
    if cfg!(feature = "debug_lib") {
        Ok(true)
    } else {
        Ok(false)
    }
}
