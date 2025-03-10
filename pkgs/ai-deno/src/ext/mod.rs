use deno_error::JsErrorBox;
use deno_runtime::deno_core::{
    ascii_str_include, extension, op2, serde_json, Extension, ExtensionFileSource, OpState,
};
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
    ops = [op_ai_alert],
    options = {
        aiExt: AiExtOptions,
    },
    state = |state, options| {
        // state.put::<AiExtOptions>(options.aiExt);
    },
    customizer = |ext: &mut Extension| {
        ext.esm_files.to_mut().push(ExtensionFileSource::new(
            "ext:ai_extension.ts",
            ascii_str_include!("./js/ai_extension.ts"),
        ));
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
