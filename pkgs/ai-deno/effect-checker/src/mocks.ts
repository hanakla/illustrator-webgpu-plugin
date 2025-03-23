globalThis._AI_DENO_ = {
  op_ai_alert: (msg: string) => {
    alert(msg);
  },
  op_ai_deno_get_user_locale: () => {
    return "ja_JP";
  },
  op_aideno_debug_enabled: () => {
    return true;
  },
  op_ai_get_plugin_version: () => {
    return "0.0.1";
  },
};
