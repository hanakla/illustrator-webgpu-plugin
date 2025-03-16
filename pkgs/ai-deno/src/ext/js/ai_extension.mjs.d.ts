declare module "ai-deno:ops" {
  export function op_aideno_debug_enabled(): boolean;

  namespace globalThis {
    var _AI_DENO_: {
      op_aideno_debug_enabled: () => boolean;
      op_ai_alert: (message: string) => void;
    };
  }
}
