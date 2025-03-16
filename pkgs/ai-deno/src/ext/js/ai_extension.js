import {
  op_ai_alert,
  op_ai_deno_get_user_locale,
  op_aideno_debug_enabled,
} from "ext:core/ops";

console.log({
  op_ai_alert,
  op_ai_deno_get_user_locale,
  op_aideno_debug_enabled,
});

globalThis._AI_DENO_ = {
  op_ai_alert,
  op_ai_deno_get_user_locale,
  op_aideno_debug_enabled,
};
