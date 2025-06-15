const _AI_DENO_ = globalThis._AI_DENO_ ?? {
  op_aideno_debug_enabled: () => true,
  op_ai_alert: () => {},
};

const enableLogger = _AI_DENO_.op_aideno_debug_enabled();
console.log(
  "%c[deno_ai(js)]%c enableLogger",
  "font-weight:bold",
  "",
  enableLogger
);

export const logger = {
  log: (...args: any[]) => {
    if (!enableLogger) return;
    console.log("%c[deno_ai(js)]%c", "font-weight:bold", "", ...args);
  },
  info: (...args: any[]) => {
    if (!enableLogger) return;
    console.info("%c[deno_ai(js)]%c", "font-weight:bold", "", ...args);
  },
  error: (...args: any[]) => {
    if (!enableLogger) return;
    console.error("%c[deno_ai(js)]%c", "font-weight:bold", "", ...args);
  },
  time: (label: string) => {
    if (!enableLogger) return;
    console.time(label);
  },
  timeEnd: (label: string) => {
    if (!enableLogger) return;
    console.timeEnd(label);
  },
};
