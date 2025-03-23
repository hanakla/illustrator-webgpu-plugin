import {
  op_ai_alert,
  op_ai_deno_get_user_locale,
  op_aideno_debug_enabled,
  op_ai_get_plugin_version,
} from "ext:core/ops";

globalThis._AI_DENO_ = {
  op_ai_alert,
  op_ai_deno_get_user_locale,
  op_aideno_debug_enabled,
  op_ai_get_plugin_version,
};
