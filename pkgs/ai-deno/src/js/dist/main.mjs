// src/js/src/main.ts
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl as toFileUrl2, join as join2, fromFileUrl } from "jsr:@std/path@1.0.8";
import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";
import { homedir } from "node:os";

// src/js/src/live-effects/chromatic-aberration.ts
import {
  makeShaderDataDefinitions,
  makeStructuredView
} from "npm:webgpu-utils";

// src/js/src/plugin.ts
function definePlugin(plugin) {
  return plugin;
}

// src/js/src/ui/nodes.ts
import { z } from "npm:zod@3.24.2";
var ui = {
  group: ({ direction = "row" }, children) => fillByNull({
    type: "group",
    direction,
    children: children.filter((child) => !!child)
  }),
  button: (props) => fillByNull({
    text: props.text,
    onClick: props.onClick,
    disabled: props.disabled,
    type: "button"
  }),
  slider: (props) => fillByNull({
    key: props.key,
    dataType: props.dataType,
    min: props.min,
    max: props.max,
    value: props.value,
    onChange: props.onChange,
    type: "slider"
  }),
  checkbox: (props) => fillByNull({
    key: props.key,
    label: props.label,
    value: props.value,
    onChange: props.onChange,
    type: "checkbox"
  }),
  textInput: (props) => fillByNull({
    key: props.key,
    value: props.value,
    onChange: props.onChange,
    type: "textInput"
  }),
  numberInput: (props) => fillByNull({
    key: props.key,
    dataType: props.dataType,
    min: props.min,
    max: props.max,
    step: props.step,
    value: props.value,
    onChange: props.onChange,
    type: "numberInput"
  }),
  colorInput: (props) => fillByNull({
    key: props.key,
    value: props.value,
    onChange: props.onChange,
    type: "colorInput"
  }),
  text: (props) => fillByNull({
    text: props.text,
    size: props.size || "normal",
    type: "text"
  }),
  select: (props) => fillByNull({
    key: props.key,
    options: props.options,
    value: props.value,
    onChange: props.onChange,
    selectedIndex: props.options.findIndex(
      (option) => option.value === props.value
    ),
    type: "select"
  }),
  separator: () => fillByNull({
    type: "separator"
  })
};
function fillByNull(obj) {
  Object.keys(obj).forEach((key) => {
    const _k = key;
    if (obj[_k] === null) {
      obj[_k] = obj[_k] ?? null;
    }
  });
  return obj;
}
var ChangeEventSchema = z.object({
  type: z.literal("change"),
  value: z.any()
});
var ChangeEventHandlerSchema = z.function().args(ChangeEventSchema).returns(z.union([z.void(), z.promise(z.void())]));
var ChangeEventHandlerSchemaWith = (type) => {
  return z.function().args(
    ChangeEventSchema.extend({
      value: type
    })
  ).returns(z.union([z.void(), z.promise(z.void())]));
};
var ClickEventSchema = z.object({
  type: z.literal("click")
});
var ClickEventHandlerSchema = z.function().args(ClickEventSchema).returns(z.union([z.void(), z.promise(z.void())]));
var UiNodeSliderSchema = z.object({
  type: z.literal("slider"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  dataType: z.enum(["int", "float"]),
  min: z.number(),
  max: z.number(),
  value: z.number(),
  onChange: ChangeEventHandlerSchemaWith(z.number()).optional()
});
var UiNodeCheckboxSchema = z.object({
  type: z.literal("checkbox"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  label: z.string(),
  value: z.boolean(),
  onChange: ChangeEventHandlerSchemaWith(z.boolean()).optional()
});
var UiNodeTextInputSchema = z.object({
  type: z.literal("textInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  value: z.string(),
  onChange: ChangeEventHandlerSchemaWith(z.string()).optional()
});
var UiNodeNumberInputSchema = z.object({
  type: z.literal("numberInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  dataType: z.enum(["int", "float"]),
  value: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  onChange: ChangeEventHandlerSchemaWith(z.number()).optional()
});
var UiNodeColorInput = z.object({
  type: z.literal("colorInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  value: z.object({
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
    a: z.number().min(0).max(1)
  }),
  onChange: ChangeEventHandlerSchemaWith(
    z.object({
      r: z.number().min(0).max(1),
      g: z.number().min(0).max(1),
      b: z.number().min(0).max(1),
      a: z.number().min(0).max(1)
    })
  ).optional()
});
var UiNodeTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  size: z.enum(["sm", "normal"]).optional()
});
var UiNodeButtonSchema = z.object({
  type: z.literal("button"),
  text: z.string(),
  disabled: z.boolean().optional(),
  onClick: ClickEventHandlerSchema.optional()
});
var UiSelectSchema = z.object({
  type: z.literal("select"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string()
    })
  ),
  value: z.string(),
  selectedIndex: z.number(),
  onChange: ChangeEventHandlerSchemaWith(z.string()).optional()
});
var UiSeparatorSchema = z.object({
  type: z.literal("separator")
});
var UiNodeGroupSchema = z.lazy(
  () => z.object({
    type: z.literal("group"),
    direction: z.enum(["col", "row"]),
    disabled: z.boolean().optional(),
    children: z.array(UI_NODE_SCHEMA)
  })
);
var UI_NODE_SCHEMA = z.union([
  UiNodeGroupSchema,
  UiNodeSliderSchema,
  UiNodeCheckboxSchema,
  UiNodeTextInputSchema,
  UiNodeNumberInputSchema,
  UiNodeColorInput,
  UiNodeTextSchema,
  UiNodeButtonSchema,
  UiSelectSchema,
  UiSeparatorSchema
]);

// src/js/src/ui/locale.ts
var texts = (t22) => t22;
function createTranslator(texts2) {
  const locale = getLocale(Object.keys(texts2), "en");
  return (key, params = {}) => {
    var _a;
    const text = (_a = texts2[locale]) == null ? void 0 : _a[key];
    if (!text) return key;
    return text.replace(/\{\{(.+?)\}\}/g, (_, key2) => {
      const value = params[key2];
      return value == null ? "" : String(value);
    });
  };
}
function getLocale(acceptLocales, fallbackLocale) {
  const userLocale = _AI_DENO_.op_ai_deno_get_user_locale().split("_")[0];
  if (acceptLocales.includes(userLocale)) {
    return userLocale;
  }
  return fallbackLocale;
}

// src/js/src/live-effects/_utils.ts
import { decodeBase64 } from "jsr:@std/encoding@1.0.7";
var createCanvasImpl = typeof window === "undefined" ? async (width, height) => {
  const { createCanvas: createCanvas5 } = await import("jsr:@gfx/canvas");
  return createCanvas5(width, height);
} : async (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
var createImageDataImpl = typeof window === "undefined" ? async (data, width, height, settings) => {
  const { ImageData: ImageData2 } = await import("jsr:@gfx/canvas");
  return new ImageData2(data, width, height, settings);
} : async (data, width, height, settings) => {
  return new ImageData(
    data,
    width,
    height,
    settings
  );
};
async function toBlob(canvas, mime, quality) {
  if (typeof window === "undefined") {
    mime = mime.replace(/^image\//, "");
    const b64 = canvas.toDataURL(mime, quality).split(",")[1];
    const buffer = decodeBase64(b64);
    return new Blob([buffer], { type: mime });
  } else {
    return new Promise((r) => {
      canvas.toBlob((b) => r(b), mime, quality);
    });
  }
}
function createCanvas(width, height) {
  return createCanvasImpl(width, height);
}
function getNearestAligned256Resolution(width, height, bytesPerPixel = 4) {
  const currentBytesPerRow = width * bytesPerPixel;
  const targetBytesPerRow = Math.ceil(currentBytesPerRow / 256) * 256;
  const newWidth = Math.round(targetBytesPerRow / bytesPerPixel);
  return {
    width: newWidth,
    height
  };
}
async function addWebGPUAlignmentPadding(imageDataLike) {
  const { width, height } = imageDataLike;
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    width,
    height
  );
  if (newWidth === width && newHeight === height) {
    return imageDataLike;
  }
  const canvas = await createCanvasImpl(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);
  ctx.putImageData(imgData, 0, 0);
  return ctx.getImageData(0, 0, newWidth, newHeight);
}
async function removeWebGPUAlignmentPadding(imageDataLike, originalWidth, originalHeight) {
  const { width, height } = imageDataLike;
  const canvas = await createCanvasImpl(originalWidth, originalHeight);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);
  ctx.putImageData(imgData, 0, 0);
  return ctx.getImageData(0, 0, originalWidth, originalHeight);
}
async function paddingImageData(data, padding) {
  padding = Math.ceil(padding);
  const width = data.width + padding * 2;
  const height = data.height + padding * 2;
  const canvas = await createCanvasImpl(width, height);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(
    data.data,
    data.width,
    data.height,
    {
      colorSpace: "srgb"
    }
  );
  ctx.putImageData(imgData, padding, padding);
  return ctx.getImageData(0, 0, width, height);
}
async function toPng(imgData) {
  const canvas = await createCanvasImpl(imgData.width, imgData.height);
  const ctx = canvas.getContext("2d");
  const img = await createImageDataImpl(
    imgData.data,
    imgData.width,
    imgData.height
  );
  ctx.putImageData(img, 0, 0);
  return toBlob(canvas, "image/png", 100);
}
function lerp(a, b, t22) {
  return a + (b - a) * t22;
}
function parseColorCode(color) {
  const hex = (color.startsWith("#") ? color.slice(1) : color).toUpperCase();
  if (!/^[0-9A-F]{3}$|^[0-9A-F]{4}$|^[0-9A-F]{6}$|^[0-9A-F]{8}$/.test(hex)) {
    return null;
  }
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    const a = parseInt(hex[3] + hex[3], 16) / 255;
    return { r, g, b, a };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const a = parseInt(hex.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return null;
}
function toColorCode(color, includeHash = false) {
  const r = Math.round(color.r * 255).toString(16).padStart(2, "0");
  const g = Math.round(color.g * 255).toString(16).padStart(2, "0");
  const b = Math.round(color.b * 255).toString(16).padStart(2, "0");
  const prefix = includeHash ? "#" : "";
  if (color.a === 1) {
    return `${prefix}${r}${g}${b}`.toLowerCase();
  }
  const a = Math.round(color.a * 255).toString(16).padStart(2, "0");
  return `${prefix}${r}${g}${b}${a}`.toLowerCase();
}

// src/js/src/logger.ts
var _AI_DENO_2 = globalThis._AI_DENO_ ?? {
  op_aideno_debug_enabled: () => true,
  op_ai_alert: () => {
  }
};
var enableLogger = _AI_DENO_2.op_aideno_debug_enabled();
console.log("[deno_ai(js)] enableLogger", enableLogger);
var logger = {
  log: (...args) => {
    if (!enableLogger) return;
    console.log("[deno_ai(js)]", ...args);
  },
  info: (...args) => {
    if (!enableLogger) return;
    console.info("[deno_ai(js)]", ...args);
  },
  error: (...args) => {
    if (!enableLogger) return;
    console.error("[deno_ai(js)]", ...args);
  },
  time: (label) => {
    if (!enableLogger) return;
    console.time(label);
  },
  timeEnd: (label) => {
    if (!enableLogger) return;
    console.timeEnd(label);
  }
};

// src/js/src/live-effects/_shared.ts
async function createGPUDevice(options = {}, initializer) {
  var _a;
  let deviceRef = null;
  let inits = null;
  const init = async () => {
    var _a2;
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
      ...options.adapter
    });
    if (!adapter) {
      throw new Error("No adapter found");
    }
    const device = await adapter.requestDevice({
      ...options.device,
      requiredLimits: {
        ...(_a2 = options.device) == null ? void 0 : _a2.requiredLimits,
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D
      }
    });
    device.addEventListener("uncapturederror", (e) => {
      console.error(e.error);
    });
    inits = await initializer(device);
    return device;
  };
  deviceRef = await init();
  logger.info("Create GPU Device: ", ((_a = options.device) == null ? void 0 : _a.label) ?? "<<unnamed>>");
  return new Proxy(
    {},
    {
      get(_, key) {
        if (key === "device") {
          return deviceRef;
        }
        return Reflect.get(inits, key);
      },
      has(_, p) {
        return Reflect.has(inits, p);
      }
    }
  );
}
function includeOklchMix() {
  return `
    // Drop-in replacement for mix() that works with vec3f rgb colors
    fn mixOklch(rgbColor1: vec3<f32>, rgbColor2: vec3<f32>, t: f32) -> vec3<f32> {
      // RGB -> Linear RGB
      let linearColor1 = vec3<f32>(
        select(rgbColor1.r / 12.92, pow((rgbColor1.r + 0.055) / 1.055, 2.4), rgbColor1.r <= 0.04045),
        select(rgbColor1.g / 12.92, pow((rgbColor1.g + 0.055) / 1.055, 2.4), rgbColor1.g <= 0.04045),
        select(rgbColor1.b / 12.92, pow((rgbColor1.b + 0.055) / 1.055, 2.4), rgbColor1.b <= 0.04045),
      );

      let linearrgbColor2 = vec3<f32>(
        select(rgbColor2.r / 12.92, pow((rgbColor2.r + 0.055) / 1.055, 2.4), rgbColor2.r <= 0.04045),
        select(rgbColor2.g / 12.92, pow((rgbColor2.g + 0.055) / 1.055, 2.4), rgbColor2.g <= 0.04045),
        select(rgbColor2.b / 12.92, pow((rgbColor2.b + 0.055) / 1.055, 2.4), rgbColor2.b <= 0.04045),
      );

      // Linear RGB -> LMS
      let lms1 = mat3x3<f32>(
        0.4122214708, 0.5363325363, 0.0514459929,
        0.2119034982, 0.6806995451, 0.1073969566,
        0.0883024619, 0.2817188376, 0.6299787005
      ) * linearColor1;

      let lms2 = mat3x3<f32>(
        0.4122214708, 0.5363325363, 0.0514459929,
        0.2119034982, 0.6806995451, 0.1073969566,
        0.0883024619, 0.2817188376, 0.6299787005
      ) * linearrgbColor2;

      // LMS -> Oklab
      let lms1_pow = vec3<f32>(pow(lms1.x, 1.0/3.0), pow(lms1.y, 1.0/3.0), pow(lms1.z, 1.0/3.0));
      let lms2_pow = vec3<f32>(pow(lms2.x, 1.0/3.0), pow(lms2.y, 1.0/3.0), pow(lms2.z, 1.0/3.0));

      let oklabMatrix = mat3x3<f32>(
        0.2104542553, 0.7936177850, -0.0040720468,
        1.9779984951, -2.4285922050, 0.4505937099,
        0.0259040371, 0.7827717662, -0.8086757660
      );

      let oklab1 = oklabMatrix * lms1_pow;
      let oklab2 = oklabMatrix * lms2_pow;

      // Oklab -> OKLCH
      let L1 = oklab1.x;
      let L2 = oklab2.x;
      let C1 = sqrt(oklab1.y * oklab1.y + oklab1.z * oklab1.z);
      let C2 = sqrt(oklab2.y * oklab2.y + oklab2.z * oklab2.z);
      let H1 = atan2(oklab1.z, oklab1.y);
      let H2 = atan2(oklab2.z, oklab2.y);

      // \u8272\u76F8\u306E\u88DC\u9593\uFF08\u6700\u77ED\u7D4C\u8DEF\uFF09
      let hDiff = H2 - H1;
      let hDiffAdjusted = select(
        hDiff,
        hDiff - 2.0 * 3.14159265359,
        hDiff > 3.14159265359
      );
      let hDiffFinal = select(
        hDiffAdjusted,
        hDiffAdjusted + 2.0 * 3.14159265359,
        hDiffAdjusted < -3.14159265359
      );

      let L = mix(L1, L2, t);
      let C = mix(C1, C2, t);
      let H = H1 + t * hDiffFinal;

      // OKLCH -> Oklab
      let a = C * cos(H);
      let b = C * sin(H);

      // Oklab -> LMS
      let oklabInverseMatrix = mat3x3<f32>(
        1.0, 0.3963377774, 0.2158037573,
        1.0, -0.1055613458, -0.0638541728,
        1.0, -0.0894841775, -1.2914855480
      );

      let lms_pow = oklabInverseMatrix * vec3<f32>(L, a, b);
      let lms = vec3<f32>(
        pow(lms_pow.x, 3.0),
        pow(lms_pow.y, 3.0),
        pow(lms_pow.z, 3.0)
      );

      // LMS -> Linear RGB
      let lmsToRgbMatrix = mat3x3<f32>(
        4.0767416621, -3.3077115913, 0.2309699292,
        -1.2684380046, 2.6097574011, -0.3413193965,
        -0.0041960863, -0.7034186147, 1.7076147010
      );

      let linearRgb = lmsToRgbMatrix * lms;

      // Linear RGB -> RGB
      let rgbResult = vec3<f32>(
        select(12.92 * linearRgb.r, 1.055 * pow(linearRgb.r, 1.0/2.4) - 0.055, linearRgb.r <= 0.0031308),
        select(12.92 * linearRgb.g, 1.055 * pow(linearRgb.g, 1.0/2.4) - 0.055, linearRgb.g <= 0.0031308),
        select(12.92 * linearRgb.b, 1.055 * pow(linearRgb.b, 1.0/2.4) - 0.055, linearRgb.b <= 0.0031308),
      );

      return clamp(rgbResult, vec3<f32>(0.0), vec3<f32>(1.0));
    }

    fn mixOklchVec4(rgbColor1: vec4<f32>, rgbColor2: vec4<f32>, t: f32) -> vec4<f32> {
      return vec4<f32>(
        mixOklch(rgbColor1.rgb, rgbColor2.rgb, t),
        mix(rgbColor1.a, rgbColor2.a, t)
      );
    }
  `;
}

// src/js/src/live-effects/chromatic-aberration.ts
var t = createTranslator(
  texts({
    en: {
      title: "Chromatic Aberration V1",
      colorMode: "Color Mode",
      shiftType: "Shift Type",
      shiftTypeMove: "Move",
      shiftTypeZoom: "Zoom",
      strength: "Strength",
      angle: "Angle",
      opacity: "Opacity",
      blendMode: "Blend Mode",
      blendOver: "Over",
      blendeUnder: "Under",
      pastelMode: "Pastel",
      useFocusPoint: "Use Focus Point",
      focusPointX: "Focus Point X",
      focusPointY: "Focus Point Y",
      focusGradient: "Focus Gradient"
    },
    ja: {
      title: "\u8272\u53CE\u5DEE V1",
      colorMode: "\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9",
      shiftType: "\u305A\u308C\u30BF\u30A4\u30D7",
      shiftTypeMove: "\u79FB\u52D5",
      shiftTypeZoom: "\u30BA\u30FC\u30E0",
      strength: "\u5F37\u5EA6",
      angle: "\u89D2\u5EA6",
      opacity: "\u4E0D\u900F\u660E\u5EA6",
      blendMode: "\u30D6\u30EC\u30F3\u30C9\u30E2\u30FC\u30C9",
      blendOver: "\u4E0A\u306B\u5408\u6210",
      blendeUnder: "\u4E0B\u306B\u5408\u6210",
      pastelMode: "\u30D1\u30B9\u30C6\u30EB",
      useFocusPoint: "\u30D5\u30A9\u30FC\u30AB\u30B9\u30DD\u30A4\u30F3\u30C8\u4F7F\u7528",
      focusPointX: "\u30D5\u30A9\u30FC\u30AB\u30B9\u30DD\u30A4\u30F3\u30C8X",
      focusPointY: "\u30D5\u30A9\u30FC\u30AB\u30B9\u30DD\u30A4\u30F3\u30C8Y",
      focusGradient: "\u30D5\u30A9\u30FC\u30AB\u30B9\u52FE\u914D"
    }
  })
);
var chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      colorMode: {
        type: "string",
        enum: ["rgb", "cmyk", "pastel", "rc"],
        default: "rgb"
      },
      shiftType: {
        type: "string",
        enum: ["move", "zoom"],
        default: "move"
      },
      strength: {
        type: "real",
        default: 1
      },
      angle: {
        type: "real",
        default: 0
      },
      opacity: {
        type: "real",
        default: 100
      },
      blendMode: {
        type: "string",
        enum: ["over", "under"],
        default: "under"
      },
      useFocusPoint: {
        type: "bool",
        default: false
      },
      focusPointX: {
        type: "real",
        default: 0.5
      },
      focusPointY: {
        type: "real",
        default: 0.5
      },
      focusGradient: {
        type: "real",
        default: 0.5
      }
    },
    onEditParameters: (params) => params,
    onAdjustColors: (params, adjustColor) => params,
    onInterpolate: (params, paramsB, progress) => ({
      colorMode: params.colorMode,
      shiftType: params.shiftType,
      strength: lerp(params.strength, paramsB.strength, progress),
      angle: lerp(params.angle, paramsB.angle, progress),
      opacity: lerp(params.opacity, paramsB.opacity, progress),
      blendMode: params.blendMode,
      useFocusPoint: params.useFocusPoint,
      focusPointX: lerp(params.focusPointX, paramsB.focusPointX, progress),
      focusPointY: lerp(params.focusPointY, paramsB.focusPointY, progress),
      focusGradient: lerp(
        params.focusGradient,
        paramsB.focusGradient,
        progress
      )
    }),
    onScaleParams: (params, scale) => ({
      colorMode: params.colorMode,
      shiftType: params.shiftType,
      strength: params.strength * scale,
      angle: params.angle,
      opacity: params.opacity,
      blendMode: params.blendMode,
      useFocusPoint: params.useFocusPoint,
      focusPointX: params.focusPointX,
      focusPointY: params.focusPointY,
      focusGradient: params.focusGradient
    }),
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            { value: "rgb", label: "RGB" },
            { value: "cmyk", label: "CMYK" },
            { value: "rc", label: "Red & Cyan" },
            { value: "pastel", label: t("pastelMode") }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("shiftType") }),
          ui.select({ key: "shiftType", value: params.shiftType, options: [
            { value: "move", label: t("shiftTypeMove") },
            { value: "zoom", label: t("shiftTypeZoom") }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: "float", min: 0, max: 200, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: "float", value: params.strength })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angle", dataType: "float", min: 0, max: 360, value: params.angle }),
            ui.numberInput({ key: "angle", dataType: "float", value: params.angle })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "opacity", dataType: "float", min: 0, max: 100, value: params.opacity }),
            ui.numberInput({ key: "opacity", dataType: "float", value: params.opacity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Blend Mode" }),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            { value: "over", label: t("blendOver") },
            { value: "under", label: t("blendeUnder") }
          ] })
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "useFocusPoint", label: t("useFocusPoint"), value: params.useFocusPoint })
        ]),
        !params.useFocusPoint ? null : ui.group({ direction: "col" }, [
          ui.group({ direction: "col" }, [
            ui.text({ text: t("focusPointX") }),
            ui.group({ direction: "row" }, [
              ui.slider({ key: "focusPointX", dataType: "float", min: 0, max: 1, value: params.focusPointX }),
              ui.numberInput({ key: "focusPointX", dataType: "float", value: params.focusPointX })
            ])
          ]),
          ui.group({ direction: "col" }, [
            ui.text({ text: t("focusPointY") }),
            ui.group({ direction: "row" }, [
              ui.slider({ key: "focusPointY", dataType: "float", min: 0, max: 1, value: params.focusPointY }),
              ui.numberInput({ key: "focusPointY", dataType: "float", value: params.focusPointY })
            ])
          ]),
          ui.group({ direction: "col" }, [
            ui.text({ text: t("focusGradient") }),
            ui.group({ direction: "row" }, [
              ui.slider({ key: "focusGradient", dataType: "float", min: 0.1, max: 5, value: params.focusGradient }),
              ui.numberInput({ key: "focusGradient", dataType: "float", value: params.focusGradient })
            ])
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const code = `
          struct Params {
            outputSize: vec2i,
            dpiScale: f32,
            strength: f32,
            angle: f32,
            colorMode: u32,
            opacity: f32,
            blendMode: u32,
            useFocusPoint: u32,
            focusPointX: f32,
            focusPointY: f32,
            focusGradient: f32,
            isInPreview: u32,
            shiftType: u32
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
            let radians = angle * 3.14159 / 180.0;
            return vec2f(cos(radians), sin(radians));
          }

          fn screenBlend(a: f32, b: f32) -> f32 {
              return 1.0 - (1.0 - a) * (1.0 - b);
          }

          fn rgbToCmyk(rgb: vec3f) -> vec4f {
              let r = rgb.r;
              let g = rgb.g;
              let b = rgb.b;

              let k = 1.0 - max(max(r, g), b);

              if (k == 1.0) {
                  return vec4f(0.0, 0.0, 0.0, 1.0);
              }

              let c = (1.0 - r - k) / (1.0 - k);
              let m = (1.0 - g - k) / (1.0 - k);
              let y = (1.0 - b - k) / (1.0 - k);

              return vec4f(c, m, y, k);
          }

          fn cmykToRgb(cmyk: vec4f) -> vec3f {
              let c = cmyk.x;
              let m = cmyk.y;
              let y = cmyk.z;
              let k = cmyk.w;

              let r = (1.0 - c) * (1.0 - k);
              let g = (1.0 - m) * (1.0 - k);
              let b = (1.0 - y) * (1.0 - k);

              return vec3f(r, g, b);
          }

          fn rgbChannelToPastel(r: f32, g: f32, b: f32) -> vec3f {
              let pastelPink = vec3f(min(r * 1.0, 1.0), r * 0.6, r * 0.8);
              let pastelYellow = vec3f(g * 0.8, min(g * 1.0, 1.0), g * 0.2);
              let pastelCyan = vec3f(b * 0.2, b * 0.8, min(b * 1.0, 1.0));

              return pastelPink + pastelYellow + pastelCyan;
          }

          fn detectChannelOverlap(r: f32, g: f32, b: f32) -> f32 {
            let threshold = 0.15;
            let hasR = select(0.0, 1.0, r > threshold);
            let hasG = select(0.0, 1.0, g > threshold);
            let hasB = select(0.0, 1.0, b > threshold);

            let channelCount = hasR + hasG + hasB;

            return select(0.0, 1.0, channelCount >= 2.5);
          }

          fn drawFocusRing(texCoord: vec2f, focusPoint: vec2f) -> f32 {
            let distance = length(texCoord - focusPoint);

            let innerRadius = 0.02;
            let outerRadius = 0.02;

            let ring = smoothstep(innerRadius - 0.005, innerRadius, distance) * (1.0 - smoothstep(outerRadius, outerRadius + 0.005, distance));

            return ring;
          }

          fn calculateDistanceBasedOffset(texCoord: vec2f, focusPoint: vec2f, baseOffset: vec2f, gradient: f32) -> vec2f {
            let distance = length(texCoord - focusPoint);
            let adjustedDistance = pow(distance, gradient);
            return baseOffset * adjustedDistance;
          }

          fn calculateZoomOffset(texCoord: vec2f, focusPoint: vec2f, strengthPixels: f32, dims: vec2f) -> vec2f {
            let direction = texCoord - focusPoint;
            // \u65B9\u5411\u30D9\u30AF\u30C8\u30EB\u3092\u30D4\u30AF\u30BB\u30EB\u5358\u4F4D\u306E\u5F37\u5EA6\u3067\u30B9\u30B1\u30FC\u30EB
            // X\u65B9\u5411\u3068Y\u65B9\u5411\u305D\u308C\u305E\u308C\u3092\u305D\u306E\u65B9\u5411\u306E\u6B21\u5143\u3067\u6B63\u898F\u5316
            return vec2f(
              direction.x * (strengthPixels / dims.x),
              direction.y * (strengthPixels / dims.y)
            );
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
            let dims = vec2f(params.outputSize);
            let texCoord = vec2f(id.xy) / dims;
            let toInputTexCoord = dims / dimsWithGPUPadding;

            let basePixelOffset = getOffset(params.angle) * params.strength * params.dpiScale;
            let baseTexOffset = basePixelOffset / dims;

            let focusPoint = select(
              vec2f(0.5, 0.5),
              vec2f(params.focusPointX, params.focusPointY),
              params.useFocusPoint != 0u
            );

            var texOffset: vec2f;
            if (params.shiftType == 0u) {
              if (params.useFocusPoint != 0u) {
                texOffset = calculateDistanceBasedOffset(texCoord, focusPoint, baseTexOffset, params.focusGradient);
              } else {
                texOffset = baseTexOffset;
              }
            } else {
              let zoomOffset = calculateZoomOffset(texCoord, focusPoint, params.strength * params.dpiScale, dims);

              let angleRad = params.angle * 3.14159 / 180.0;
              let rotCos = cos(angleRad);
              let rotSin = sin(angleRad);
              let rotatedOffset = vec2f(
                zoomOffset.x * rotCos - zoomOffset.y * rotSin,
                zoomOffset.x * rotSin + zoomOffset.y * rotCos
              );

              texOffset = rotatedOffset;

              if (params.useFocusPoint != 0u) {
                let distance = length(texCoord - focusPoint);
                let adjustedDistance = pow(distance, params.focusGradient);
                texOffset = texOffset * adjustedDistance;
              }
            }

            let opacityFactor = params.opacity / 100.0;

            var effectColor: vec4f;
            let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

            if (params.colorMode == 0u) {
              let redOffset = texCoord + texOffset;
              let blueOffset = texCoord - texOffset;

              let rs = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0);
              let gs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let bs = textureSampleLevel(inputTexture, textureSampler, blueOffset * toInputTexCoord, 0.0);

              let a_red = rs.a;
              let a_green = gs.a;
              let a_blue = bs.a;

              let a = screenBlend(screenBlend(a_red, a_green), a_blue);

              effectColor = vec4f(
                rs.r,
                gs.g,
                bs.b,
                a
              );
            } else if (params.colorMode == 1u) {
              let cyanOffset = texCoord + texOffset;
              let magentaOffset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
              let yellowOffset = texCoord - texOffset;

              let cs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);
              let ms = textureSampleLevel(inputTexture, textureSampler, magentaOffset * toInputTexCoord, 0.0);
              let ys = textureSampleLevel(inputTexture, textureSampler, yellowOffset * toInputTexCoord, 0.0);
              let origs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let cyanColor = vec3f(cs.r * 0.3, cs.g * 1.0, cs.b * 1.0);
              let magentaColor = vec3f(ms.r * 1.0, ms.g * 0.3, ms.b * 1.0);
              let yellowColor = vec3f(ys.r * 1.0, ys.g * 1.0, ys.b * 0.3);

              let combinedColor = vec3f(
                  max(max(cyanColor.r, magentaColor.r), yellowColor.r),
                  max(max(cyanColor.g, magentaColor.g), yellowColor.g),
                  max(max(cyanColor.b, magentaColor.b), yellowColor.b)
              );

              let a = screenBlend(screenBlend(cs.a, ms.a), ys.a) * opacityFactor;

              let strengthFactor = params.strength;
              let blendRatio = clamp(strengthFactor, 0.0, 1.0);
              let result = mixOklch(origs.rgb, combinedColor, blendRatio);

              effectColor = vec4f(result, a);
            } else if (params.colorMode == 2u) {
              let ch1Offset = texCoord + texOffset;
              let ch2Offset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
              let ch3Offset = texCoord - texOffset;

              let ch1s = textureSampleLevel(inputTexture, textureSampler, ch1Offset * toInputTexCoord, 0.0);
              let ch2s = textureSampleLevel(inputTexture, textureSampler, ch2Offset * toInputTexCoord, 0.0);
              let ch3s = textureSampleLevel(inputTexture, textureSampler, ch3Offset * toInputTexCoord, 0.0);
              let origs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let ch1 = vec3f(ch1s.r * 0.56, ch1s.g * 0.29, ch1s.b * 0.42);
              let ch2 = vec3f(ch2s.r * 0, ch2s.g * 0.28, ch2s.b * 0.45);
              let ch3 = vec3f(ch3s.r * 0.44, ch3s.g * 0.43, ch3s.b * 0.13);

              var combinedColor = vec3f(
                ch1.r + ch2.r + ch3.r,
                ch1.g + ch2.g + ch3.g,
                ch1.b + ch2.b + ch3.b,
              );

              let a = screenBlend(screenBlend(ch1s.a, ch2s.a), ch3s.a) * opacityFactor;

              let strengthFactor = params.strength;
              let blendRatio = clamp(strengthFactor, 0.0, 1.0);
              let result = mixOklch(origs.rgb, combinedColor, blendRatio);

              effectColor = vec4f(result, a);
            } else if (params.colorMode == 3u) {
              let redOffset = texCoord + texOffset;
              let cyanOffset = texCoord - texOffset;

              let rs = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0);
              let gs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);
              let bs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);

              let a_red = rs.a;
              let a_green = gs.a;
              let a_blue = bs.a;

              let a = screenBlend(screenBlend(a_red, a_green), a_blue);

              effectColor = vec4f(
                rs.r,
                gs.g,
                bs.b,
                a
              );
            }

            var finalColor: vec4f;

            if (opacityFactor <= 0.0) {
              finalColor = originalColor;
            } else {
              let blendedRgb = mixOklch(originalColor.rgb, effectColor.rgb, opacityFactor);

              let alphaDifference = effectColor.a - originalColor.a;
              let adjustedAlpha = originalColor.a + alphaDifference * opacityFactor;

              finalColor = vec4f(blendedRgb, adjustedAlpha);
            }

            if (params.useFocusPoint != 0u && params.isInPreview != 0u) {
              let focusPoint = vec2f(params.focusPointX, params.focusPointY);
              let ringIntensity = drawFocusRing(texCoord, focusPoint);

              let ringColor = vec4f(1.0, 1.0, 0.3, 1.0);

              finalColor = mixOklchVec4(finalColor, ringColor, ringIntensity);
            }

            textureStore(resultTexture, id.xy, finalColor);
          }

          fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32> {
            let linearColor1 = vec3<f32>(
              select(color1.r / 12.92, pow((color1.r + 0.055) / 1.055, 2.4), color1.r <= 0.04045),
              select(color1.g / 12.92, pow((color1.g + 0.055) / 1.055, 2.4), color1.g <= 0.04045),
              select(color1.b / 12.92, pow((color1.b + 0.055) / 1.055, 2.4), color1.b <= 0.04045),
            );

            let linearColor2 = vec3<f32>(
              select(color2.r / 12.92, pow((color2.r + 0.055) / 1.055, 2.4), color2.r <= 0.04045),
              select(color2.g / 12.92, pow((color2.g + 0.055) / 1.055, 2.4), color2.g <= 0.04045),
              select(color2.b / 12.92, pow((color2.b + 0.055) / 1.055, 2.4), color2.b <= 0.04045),
            );

            let lms1 = mat3x3<f32>(
              0.4122214708, 0.5363325363, 0.0514459929,
              0.2119034982, 0.6806995451, 0.1073969566,
              0.0883024619, 0.2817188376, 0.6299787005
            ) * linearColor1;

            let lms2 = mat3x3<f32>(
              0.4122214708, 0.5363325363, 0.0514459929,
              0.2119034982, 0.6806995451, 0.1073969566,
              0.0883024619, 0.2817188376, 0.6299787005
            ) * linearColor2;

            let lms1_pow = vec3<f32>(pow(lms1.x, 1.0/3.0), pow(lms1.y, 1.0/3.0), pow(lms1.z, 1.0/3.0));
            let lms2_pow = vec3<f32>(pow(lms2.x, 1.0/3.0), pow(lms2.y, 1.0/3.0), pow(lms2.z, 1.0/3.0));

            let oklabMatrix = mat3x3<f32>(
              0.2104542553, 0.7936177850, -0.0040720468,
              1.9779984951, -2.4285922050, 0.4505937099,
              0.0259040371, 0.7827717662, -0.8086757660
            );

            let oklab1 = oklabMatrix * lms1_pow;
            let oklab2 = oklabMatrix * lms2_pow;

            let L1 = oklab1.x;
            let L2 = oklab2.x;
            let C1 = sqrt(oklab1.y * oklab1.y + oklab1.z * oklab1.z);
            let C2 = sqrt(oklab2.y * oklab2.y + oklab2.z * oklab2.z);
            let H1 = atan2(oklab1.z, oklab1.y);
            let H2 = atan2(oklab2.z, oklab2.y);

            let hDiff = H2 - H1;
            let hDiffAdjusted = select(
              hDiff,
              hDiff - 2.0 * 3.14159265359,
              hDiff > 3.14159265359
            );
            let hDiffFinal = select(
              hDiffAdjusted,
              hDiffAdjusted + 2.0 * 3.14159265359,
              hDiffAdjusted < -3.14159265359
            );

            let L = mix(L1, L2, t);
            let C = mix(C1, C2, t);
            let H = H1 + t * hDiffFinal;

            let a = C * cos(H);
            let b = C * sin(H);

            let oklabInverseMatrix = mat3x3<f32>(
              1.0, 0.3963377774, 0.2158037573,
              1.0, -0.1055613458, -0.0638541728,
              1.0, -0.0894841775, -1.2914855480
            );

            let lms_pow = oklabInverseMatrix * vec3<f32>(L, a, b);
            let lms = vec3<f32>(
              pow(lms_pow.x, 3.0),
              pow(lms_pow.y, 3.0),
              pow(lms_pow.z, 3.0)
            );

            let lmsToRgbMatrix = mat3x3<f32>(
              4.0767416621, -3.3077115913, 0.2309699292,
              -1.2684380046, 2.6097574011, -0.3413193965,
              -0.0041960863, -0.7034186147, 1.7076147010
            );

            let linearRgb = lmsToRgbMatrix * lms;

            let rgbResult = vec3<f32>(
              select(12.92 * linearRgb.r, 1.055 * pow(linearRgb.r, 1.0/2.4) - 0.055, linearRgb.r <= 0.0031308),
              select(12.92 * linearRgb.g, 1.055 * pow(linearRgb.g, 1.0/2.4) - 0.055, linearRgb.g <= 0.0031308),
              select(12.92 * linearRgb.b, 1.055 * pow(linearRgb.b, 1.0/2.4) - 0.055, linearRgb.b <= 0.0031308),
            );

            return clamp(rgbResult, vec3<f32>(0.0), vec3<f32>(1.0));
          }

          fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
            return vec4<f32>(
              mixOklch(color1.rgb, color2.rgb, t),
              mix(color1.a, color2.a, t)
            );
          }
      `;
        const shader = device.createShaderModule({
          label: "Chromatic Aberration Shader",
          code
        });
        const defs = makeShaderDataDefinitions(code);
        device.addEventListener("lost", (e) => {
          console.error(e);
        });
        device.addEventListener("uncapturederror", (e) => {
          console.error(e.error);
        });
        const pipeline = device.createComputePipeline({
          label: "Chromatic Aberration Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeMain"
          }
        });
        return { device, pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      console.log("Chromatic Aberration V1", params);
      const dpiScale = env.dpi / env.baseDpi;
      imgData = await paddingImageData(
        imgData,
        Math.ceil(params.strength * dpiScale)
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const width = imgData.width;
      const height = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformValues = makeStructuredView(defs.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const colorModeValue = params.colorMode === "rgb" ? 0 : params.colorMode === "cmyk" ? 1 : params.colorMode === "pastel" ? 2 : params.colorMode === "rc" ? 3 : 0;
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        strength: params.strength,
        angle: params.angle,
        colorMode: colorModeValue,
        opacity: params.opacity,
        blendMode: params.blendMode === "over" ? 0 : 1,
        useFocusPoint: params.useFocusPoint ? 1 : 0,
        focusPointX: params.focusPointX,
        focusPointY: params.focusPointY,
        focusGradient: params.focusGradient,
        isInPreview: env.isInPreview ? 1 : 0,
        shiftType: params.shiftType === "move" ? 0 : 1
      });
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: width * height * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: width * 4, rowsPerImage: height },
        [width, height]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Chromatic Aberration Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: width * 4 },
        [width, height]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = await removeWebGPUAlignmentPadding(
        new ImageData(new Uint8ClampedArray(resultData), width, height),
        outputWidth,
        outputHeight
      );
      return resultImageData;
    }
  }
});

// src/js/src/live-effects/test-blue-fill.ts
import { toFileUrl, join } from "jsr:@std/path@1.0.8";
var global = {
  lastInput: null,
  inputSize: null
};
var testBlueFill = definePlugin({
  id: "test-blue-fill",
  title: "Test Blue Fill",
  version: { major: 1, minor: 0 },
  liveEffect: {
    paramSchema: {
      useNewBuffer: {
        type: "bool",
        default: false
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 1, a: 1 }
      },
      fillOtherChannels: {
        type: "bool",
        default: false
      },
      passThrough: {
        type: "bool",
        default: false
      },
      fullTransparent: {
        type: "bool",
        default: false
      },
      halfFill: {
        type: "bool",
        default: false
      },
      padding: {
        type: "int",
        default: 0
      },
      opacity: {
        type: "real",
        default: 100
      },
      count: {
        type: "int",
        default: 0
      }
    },
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onScaleParams: (params, scaleFactor) => params,
    onInterpolate: (paramsA, paramsB, t22) => paramsA,
    goLiveEffect: async (init, params, input, env) => {
      console.log("[test-blue-fill] goLiveEffect", { params, env });
      let width = input.width;
      let height = input.height;
      let len = input.data.length;
      global.lastInput = {
        data: Uint8ClampedArray.from(input.data),
        width,
        height
      };
      global.inputSize = { width, height };
      const alpha = Math.round(255 * (params.opacity / 100));
      let buffer = params.useNewBuffer ? Uint8ClampedArray.from(input.data) : input.data;
      if (params.padding > 0) {
        const data = await paddingImageData(
          {
            data: buffer,
            width: input.width,
            height: input.height
          },
          params.padding
        );
        buffer = data.data;
        len = buffer.length;
        width = data.width;
        height = data.height;
      }
      if (params.passThrough) {
        return {
          data: buffer,
          width,
          height
        };
      }
      if (params.fullTransparent) {
        for (let i = 0; i < len; i += 4) {
          buffer[i + 3] = 0;
        }
        return {
          data: buffer,
          width,
          height
        };
      }
      const start = params.halfFill ? Math.ceil(height * (width * 4) / 2) : 0;
      if (params.fillOtherChannels) {
        for (let i = start; i < len; i += 4) {
          buffer[i] = 0;
          buffer[i + 1] = 0;
          buffer[i + 2] = 255;
          buffer[i + 3] = alpha;
        }
      } else {
        for (let i = start; i < len; i += 4) {
          buffer[i + 2] = 255;
          buffer[i + 3] = alpha;
        }
      }
      return {
        data: buffer,
        width,
        height
      };
    },
    renderUI: (params, { setParam }) => {
      var _a, _b;
      const onClickSaveInputAsPng = async () => {
        if (!global.lastInput) {
          _AI_DENO_.op_ai_alert("No input data");
          return;
        }
        const path = new URL(
          "./test-blue-fill.png",
          toFileUrl(join(Deno.cwd(), "./"))
        );
        const png = await toPng(global.lastInput);
        Deno.writeFile(path, new Uint8Array(await png.arrayBuffer()));
        _AI_DENO_.op_ai_alert(`Saved to ${path}`);
      };
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.button({
            text: "Update view",
            onClick: () => {
              setParam((prev) => {
                return { count: prev.count + 1 };
              });
            }
          }),
          ui.button({
            text: "Save input as PNG",
            onClick: onClickSaveInputAsPng
          }),
          ui.button({
            text: "Alert",
            onClick: () => {
              console.log("Hello");
            }
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.text({
            text: `Input: ${(_a = global.inputSize) == null ? void 0 : _a.width}x${(_b = global.inputSize) == null ? void 0 : _b.height}`
          }),
          ui.text({ text: `Count: ${params.count}` })
        ]),
        ui.group({ direction: "row" }, [
          // ui.text({ text: "Use new buffer" }),
          ui.checkbox({
            label: "Use new buffer",
            key: "useNewBuffer",
            value: params.useNewBuffer
          }),
          // ui.text({ text: "Fill other channels" }),
          ui.checkbox({
            key: "fillOtherChannels",
            label: "Fill other channels",
            value: params.fillOtherChannels
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "passThrough",
            label: "Pass through",
            value: params.passThrough
          }),
          ui.checkbox({
            key: "fullTransparent",
            label: "Full transparent",
            value: params.fullTransparent
          })
        ]),
        ui.text({ text: "Color" }),
        ui.colorInput({
          key: "color",
          value: params.color
        }),
        ui.text({ text: "Padding" }),
        ui.group({ direction: "row" }, [
          ui.slider({
            key: "padding",
            dataType: "int",
            min: 0,
            max: 100,
            value: params.padding
          }),
          ui.numberInput({
            dataType: "int",
            key: "padding",
            value: params.padding,
            min: 0,
            max: 100,
            step: 1
          })
        ]),
        ui.text({ text: "Opacity" }),
        ui.slider({
          key: "opacity",
          dataType: "float",
          min: 0,
          max: 100,
          value: params.opacity
        }),
        ui.textInput({ value: "Hello" })
      ]);
    }
  }
});

// src/js/src/live-effects/directional-blur.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions2,
  makeStructuredView as makeStructuredView2
} from "npm:webgpu-utils";
var t2 = createTranslator({
  en: {
    title: "Directional Blur V1",
    strength: "Size (px)",
    direction: "Direction",
    opacity: "Opacity",
    blurMode: "Blur Mode",
    behind: "Behind",
    front: "Front",
    both: "Both",
    originalEmphasis: "Original Emphasis",
    fadeScale: "Scale to fade",
    fadeDirection: "Direction to fade"
  },
  ja: {
    title: "\u65B9\u5411\u30D6\u30E9\u30FC V1",
    strength: "\u5927\u304D\u3055 (px)",
    direction: "\u65B9\u5411",
    opacity: "\u4E0D\u900F\u660E\u5EA6",
    blurMode: "\u30D6\u30E9\u30FC\u30E2\u30FC\u30C9",
    behind: "\u5F8C\u65B9",
    front: "\u524D\u65B9",
    both: "\u4E21\u65B9",
    originalEmphasis: "\u5143\u753B\u50CF\u306E\u5F37\u8ABF",
    fadeScale: "\u7E2E\u5C0F\u7387",
    fadeDirection: "\u7E2E\u5C0F\u65B9\u5411"
  }
});
var directionalBlur = definePlugin({
  id: "directional-blur-v1",
  title: t2("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 5
      },
      angle: {
        type: "real",
        default: 0
      },
      opacity: {
        type: "real",
        default: 100
      },
      blurMode: {
        type: "string",
        enum: ["both", "behind", "front"],
        default: "both"
      },
      originalEmphasis: {
        type: "real",
        default: 0
      },
      fadeOut: {
        type: "real",
        default: 0
      },
      fadeDirection: {
        type: "real",
        default: 0
      }
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onInterpolate: (a, b, progress) => {
      return {
        strength: lerp(a.strength, b.strength, progress),
        angle: lerp(a.angle, b.angle, progress),
        opacity: lerp(a.opacity, b.opacity, progress),
        blurMode: b.blurMode,
        originalEmphasis: lerp(
          a.originalEmphasis || 0,
          b.originalEmphasis || 0,
          progress
        ),
        fadeOut: lerp(a.fadeOut, b.fadeOut, progress),
        fadeDirection: lerp(a.fadeDirection, b.fadeDirection, progress)
      };
    },
    onScaleParams: (params, scale) => {
      return {
        strength: params.strength * scale,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: params.blurMode,
        originalEmphasis: params.originalEmphasis,
        fadeOut: params.fadeOut,
        fadeDirection: params.fadeDirection
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: 0,
              max: 500,
              value: params.strength
            }),
            ui.numberInput({
              key: "strength",
              dataType: "float",
              value: params.strength
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("direction") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "angle",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.angle
            }),
            ui.numberInput({
              key: "angle",
              dataType: "float",
              value: params.angle
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("opacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "opacity",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.opacity
            }),
            ui.numberInput({
              key: "opacity",
              dataType: "float",
              value: params.opacity
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("blurMode") }),
          ui.select({
            key: "blurMode",
            value: params.blurMode,
            options: [
              { value: "both", label: t2("both") },
              { value: "behind", label: t2("behind") },
              { value: "front", label: t2("front") }
            ]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("originalEmphasis") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "originalEmphasis",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.originalEmphasis || 0
            }),
            ui.numberInput({
              key: "originalEmphasis",
              dataType: "float",
              value: params.originalEmphasis || 0
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("fadeScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fadeOut",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.fadeOut
            }),
            ui.numberInput({
              key: "fadeOut",
              dataType: "float",
              value: params.fadeOut
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("fadeDirection") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fadeDirection",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.fadeDirection
            }),
            ui.numberInput({
              key: "fadeDirection",
              dataType: "float",
              value: params.fadeDirection
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Directional Blur V1)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              strength: f32,
              angle: f32,
              opacity: f32,
              blurMode: u32,
              originalEmphasis: f32, // \u5143\u753B\u50CF\u306E\u5F37\u8ABF\u5EA6\uFF080.0\uFF5E1.0\uFF09
              fadeOut: f32,     // \u7E2E\u5C0F\u7387\uFF1A\u30B5\u30F3\u30D7\u30EB\u756A\u53F7\u304C\u5897\u3048\u308B\u307B\u3069\u56F3\u50CF\u304C\u5C0F\u3055\u304F\u306A\u308B
              fadeDirection: f32, // \u7E2E\u5C0F\u65B9\u5411\uFF1A\u4E0A\u5BC4\u308A/\u4E0B\u5BC4\u308A
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn getOffset(angle: f32) -> vec2f {
              let radians = angle * 3.14159 / 180.0;
              return vec2f(cos(radians), sin(radians));
            }

            fn gaussianWeight(distance: f32, sigma: f32) -> f32 {
              let normalized = distance / sigma;
              return exp(-(normalized * normalized) / 2.0);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let normalizedOpacity = min(params.opacity, 100.0) / 100.0;

              if (params.strength <= 0.0 || params.opacity <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // Keep the strength in pixel space
              let adjustedStrength = params.strength * params.dpiScale;
              let pixelOffset = getOffset(params.angle) * adjustedStrength;
              let texOffset = pixelOffset / dims;

              let numSamples = max(i32(adjustedStrength), 5);

              var blurredColorRGB = vec3f(0.0);  // RGB\u6210\u5206
              var blurredAlpha = 0.0;            // \u30A2\u30EB\u30D5\u30A1\u6210\u5206
              var totalRgbWeight = 0.0;          // RGB\u7528\u306E\u91CD\u307F
              var totalAlphaWeight = 0.0;        // \u30A2\u30EB\u30D5\u30A1\u7528\u306E\u91CD\u307F

              var startSample = -numSamples;
              var endSample = numSamples;

              // blurMode: 0=both, 1=behind, 2=front
              if (params.blurMode == 1u) { // behind
                startSample = 0;
                endSample = numSamples;  // \u6B63\u306E\u65B9\u5411\u306B\u30D6\u30E9\u30FC\uFF08\u5143\u306E\u753B\u50CF\u306E\u80CC\u5F8C\uFF09
              } else if (params.blurMode == 2u) { // front
                startSample = -numSamples;
                endSample = 0;  // \u8CA0\u306E\u65B9\u5411\u306B\u30D6\u30E9\u30FC\uFF08\u5143\u306E\u753B\u50CF\u306E\u524D\u65B9\uFF09
              }

              for (var i = startSample; i <= endSample; i++) {
                // \u4E2D\u592E\u306E\u30B5\u30F3\u30D7\u30EB\uFF08i = 0\uFF09\u306F\u5143\u306E\u753B\u50CF\u3092\u305D\u306E\u307E\u307E\u4F7F\u7528
                if (i == 0) {
                  // \u4E2D\u5FC3\u30B5\u30F3\u30D7\u30EB\u306F\u76F4\u63A5\u8FFD\u52A0
                  blurredColorRGB += originalColor.rgb * originalColor.a;
                  blurredAlpha += originalColor.a;
                  totalRgbWeight += 1.0;
                  totalAlphaWeight += 1.0;
                  continue;
                }

                let blurIntensity = 1.5;
                let sampleOffset = f32(i) / f32(numSamples) * blurIntensity;

                let normalizedDistance = f32(abs(i)) / f32(numSamples);
                let baseCoord = texCoord + texOffset * sampleOffset;

                var sampleCoord = baseCoord;
                if (params.fadeOut > 0.0) {
                  // \u7E2E\u5C0F\u7387\u306E\u8A08\u7B97\uFF080.0\uFF5E1.0\uFF09
                  let scale = max(1.0 - (normalizedDistance * params.fadeOut), 0.01);

                  // \u753B\u50CF\u4E2D\u5FC3\u3092\u539F\u70B9\u3068\u3057\u3066\u62E1\u5927\u7E2E\u5C0F
                  let center = vec2f(0.5, 0.5);
                  sampleCoord = center + (baseCoord - center) / scale;

                  // \u7E2E\u5C0F\u65B9\u5411\u306E\u9069\u7528\uFF08\u4E0A\u4E0B\u65B9\u5411\u306E\u30B7\u30D5\u30C8\uFF09
                  if (params.fadeDirection != 0.0) {
                    // \u6B63\u306E\u5024\uFF1A\u4E0B\u65B9\u5411\u3001\u8CA0\u306E\u5024\uFF1A\u4E0A\u65B9\u5411
                    let shift = (1.0 - scale) * 0.5 * params.fadeDirection;
                    sampleCoord.y += shift;
                  }
                }

                sampleCoord = clamp(sampleCoord, vec2f(0.0), vec2f(1.0));
                let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord * toInputTexCoord, 0.0);

                let sigma = 0.5;
                let weight = gaussianWeight(normalizedDistance, sigma);

                // \u30B5\u30F3\u30D7\u30EB\u8272\u3092\u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u5F62\u5F0F\u3067\u84C4\u7A4D
                blurredColorRGB += sampleColor.rgb * sampleColor.a * weight;
                blurredAlpha += sampleColor.a * weight;

                totalRgbWeight += weight;
                totalAlphaWeight += weight;
              }

              var finalColor = originalColor;

              if (totalAlphaWeight > 0.0) {
                // \u30A2\u30EB\u30D5\u30A1\u3092\u6B63\u898F\u5316
                let normalizedAlpha = blurredAlpha / totalAlphaWeight;

                // RGB\u5024\u3092\u6B63\u898F\u5316\uFF08\u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u72B6\u614B\uFF09
                var normalizedRGB = vec3f(0.0);
                if (totalRgbWeight > 0.0) {
                  normalizedRGB = blurredColorRGB / vec3f(totalRgbWeight);
                }

                // \u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u304B\u3089\u30B9\u30C8\u30EC\u30FC\u30C8\u30A2\u30EB\u30D5\u30A1\u306B\u623B\u3059
                // (normalizedAlpha\u304C0\u306B\u8FD1\u3044\u5834\u5408\u306F\u5909\u63DB\u3057\u306A\u3044)
                var unpremultipliedRGB = normalizedRGB;
                if (normalizedAlpha > 0.001) {
                  unpremultipliedRGB = normalizedRGB / vec3f(normalizedAlpha);
                }

                let blurredColor = vec4f(unpremultipliedRGB, normalizedAlpha);

                finalColor = mixOklchVec4(originalColor, blurredColor, normalizedOpacity);

                let emphasisFactor = params.originalEmphasis * originalColor.a;
                let blendedRGB = mixOklch(finalColor.rgb, originalColor.rgb, emphasisFactor);
                finalColor = vec4f(blendedRGB, finalColor.a);
              } else {
                finalColor = originalColor;
              }

              // This is includes below 2 functions
              // fn mixOklch(rgbColor1: vec3<f32>, rgbColor2: vec3<f32>, t: f32) -> vec3<f32>;
              // fn mixOklchVec4(rgbColor1: vec4<f32>, rgbColor2: vec4<f32>, t: f32) -> vec4<f32>;
              textureStore(resultTexture, id.xy, finalColor);
            }

            ${includeOklchMix()}
          `;
          const shader = device.createShaderModule({
            label: "Directional Blur V1 Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions2(code);
          const pipeline = device.createComputePipeline({
            label: "Directional Blur V1 Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Directional Blur V1", params);
      const dpiScale = dpi / baseDpi;
      const paddingSize = Math.ceil(params.strength * dpiScale);
      imgData = await paddingImageData(imgData, paddingSize);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Directional Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Directional Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Directional Blur Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      let blurModeValue = 0;
      if (params.blurMode === "behind") {
        blurModeValue = 1;
      } else if (params.blurMode === "front") {
        blurModeValue = 2;
      }
      const uniformValues = makeStructuredView2(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Directional Blur Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        strength: params.strength,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: blurModeValue,
        originalEmphasis: params.originalEmphasis || 0,
        fadeOut: params.fadeOut || 0,
        fadeDirection: params.fadeDirection || 0
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Directional Blur Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Directional Blur Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        {
          bytesPerRow: bufferInputWidth * 4,
          rowsPerImage: bufferInputHeight
        },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Directional Blur Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Directional Blur Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/kirakira-blur.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions3,
  makeStructuredView as makeStructuredView3
} from "npm:webgpu-utils";
var t3 = createTranslator({
  en: {
    title: "Kirakira Blur",
    radius: "Blur Radius (px)",
    strength: "Blur Strength",
    sparkle: "Sparkle Intensity",
    makeOriginalTransparent: "Make Original Transparent",
    useCustomColor: "Use Custom Blur Color",
    customColor: "Custom Blur Color"
  },
  ja: {
    title: "\u30AD\u30E9\u30AD\u30E9\u30D6\u30E9\u30FC",
    radius: "\u307C\u304B\u3057\u534A\u5F84 (px)",
    strength: "\u307C\u304B\u3057\u5F37\u5EA6",
    sparkle: "\u304D\u3089\u3081\u304D\u5F37\u5EA6",
    makeOriginalTransparent: "\u5143\u753B\u50CF\u3092\u900F\u660E\u306B\u3059\u308B",
    useCustomColor: "\u30AB\u30B9\u30BF\u30E0\u30D6\u30E9\u30FC\u8272\u3092\u4F7F\u7528",
    customColor: "\u30AB\u30B9\u30BF\u30E0\u30D6\u30E9\u30FC\u8272"
  }
});
var kirakiraBlur = definePlugin({
  id: "kirakira-blur-v1",
  title: t3("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      radius: {
        type: "int",
        default: 10
      },
      strength: {
        type: "real",
        default: 1
      },
      sparkle: {
        type: "real",
        default: 0.5
      },
      makeOriginalTransparent: {
        type: "bool",
        default: false
      },
      useCustomColor: {
        type: "bool",
        default: false
      },
      customColor: {
        type: "color",
        default: {
          r: 1,
          g: 1,
          b: 1,
          a: 1
        }
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        radius: Math.max(0, Math.min(200, params.radius)),
        strength: Math.max(0, Math.min(2, params.strength))
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        customColor: adjustColor(params.customColor)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        radius: Math.round(params.radius * scaleFactor),
        strength: params.strength,
        sparkle: params.sparkle,
        makeOriginalTransparent: params.makeOriginalTransparent,
        useCustomColor: params.useCustomColor,
        customColor: params.customColor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        radius: Math.round(lerp(paramsA.radius, paramsB.radius, t22)),
        strength: lerp(paramsA.strength, paramsB.strength, t22),
        sparkle: lerp(paramsA.sparkle, paramsB.sparkle, t22),
        makeOriginalTransparent: t22 < 0.5 ? paramsA.makeOriginalTransparent : paramsB.makeOriginalTransparent,
        useCustomColor: t22 < 0.5 ? paramsA.useCustomColor : paramsB.useCustomColor,
        customColor: {
          r: lerp(paramsA.customColor.r, paramsB.customColor.r, t22),
          g: lerp(paramsA.customColor.g, paramsB.customColor.g, t22),
          b: lerp(paramsA.customColor.b, paramsB.customColor.b, t22),
          a: lerp(paramsA.customColor.a, paramsB.customColor.a, t22)
        }
      };
    },
    renderUI: (params, { setParam }) => {
      const customColorStr = toColorCode(params.customColor);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("radius") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "radius", dataType: "int", min: 1, max: 200, value: params.radius }),
            ui.numberInput({ key: "radius", dataType: "int", value: params.radius })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: "float", min: 0, max: 2, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: "float", value: params.strength })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sparkle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "sparkle", dataType: "float", min: 0, max: 1, value: params.sparkle }),
            ui.numberInput({ key: "sparkle", dataType: "float", value: params.sparkle })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "useCustomColor", value: params.useCustomColor, label: t3("useCustomColor") }),
          ui.group({ direction: "row", disabled: !params.useCustomColor }, [
            ui.text({ text: t3("customColor") }),
            ui.colorInput({ key: "customColor", value: params.customColor }),
            ui.textInput({ key: "customColorText", value: customColorStr, onChange: (e) => {
              setParam({ customColor: parseColorCode(e.value) });
            } })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "makeOriginalTransparent", value: params.makeOriginalTransparent, label: t3("makeOriginalTransparent") })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Kirakira Blur)" }
        },
        (device) => {
          const verticalBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
              sparkle: f32,
              makeOriginalTransparent: i32,
              useCustomColor: i32,
              customColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn gaussianWeight(offset: f32, sigma: f32) -> f32 {
              let gaussianExp = -0.5 * (offset * offset) / (sigma * sigma);
              return exp(gaussianExp) / (2.5066282746 * sigma);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // DPI\u30B9\u30B1\u30FC\u30EB\u3092\u8003\u616E\u3057\u305F\u30D6\u30E9\u30FC\u534A\u5F84\u3068\u30B7\u30B0\u30DE\u306E\u8A08\u7B97
              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * 0.33 * params.strength;

              if (sigma <= 0.0) {
                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // \u30AB\u30B9\u30BF\u30E0\u8272\u3092\u4F7F\u7528\u3059\u308B\u304B\u3069\u3046\u304B\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u8272\u3092\u6C7A\u5B9A
              var sampledRGB: vec3f;
              if (params.useCustomColor != 0) {
                // \u30AB\u30B9\u30BF\u30E0\u8272\u3092\u4F7F\u7528\u3059\u308B\u5834\u5408
                sampledRGB = params.customColor.rgb;
              } else {
                // \u5143\u753B\u50CF\u306E\u8272\u3092\u4F7F\u7528\u3059\u308B\u5834\u5408
                sampledRGB = originalColor.rgb;
              }

              // \u30A2\u30EB\u30D5\u30A1\u5024\u306F\u5E38\u306B\u5143\u753B\u50CF\u304B\u3089\u53D6\u5F97
              let sampledAlpha = originalColor.a;

              // \u30A2\u30EB\u30D5\u30A1\u3068RGB\u3092\u5206\u3051\u3066\u8A08\u7B97\u3059\u308B\u305F\u3081\u306B\u5909\u6570\u3092\u5206\u3051\u308B
              let centerWeight = gaussianWeight(0.0, sigma);

              // \u30A2\u30EB\u30D5\u30A1\u8A08\u7B97\u7528
              var totalWeightAlpha = centerWeight;
              var resultAlpha = sampledAlpha * centerWeight;

              // RGB\u8A08\u7B97\u7528\uFF08\u30A2\u30EB\u30D5\u30A1\u3067\u91CD\u307F\u4ED8\u3051\uFF09
              var totalWeightRGB = centerWeight * sampledAlpha;
              // \u30A2\u30EB\u30D5\u30A1\u304C0\u306E\u5834\u5408\u3067\u3082RGB\u5024\u3092\u4FDD\u6301\u3059\u308B\uFF08\u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u304B\u3089\u623B\u3059\uFF09
              var resultRGB: vec3f;
              if (sampledAlpha > 0.0) {
                resultRGB = sampledRGB * centerWeight * sampledAlpha;
              } else {
                // \u30A2\u30EB\u30D5\u30A1\u304C0\u306E\u5834\u5408\u306F\u5468\u56F2\u304B\u3089\u8272\u3092\u63A8\u6E2C\u3059\u308B\u305F\u3081\u521D\u671F\u5024\u306F0
                resultRGB = vec3f(0.0);
              }

              let pixelStep = 1.0 / dims.y;
              let radiusScaledInt = i32(ceil(radiusScaled));

              for (var i = 1; i <= radiusScaledInt; i = i + 1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                let offsetUp = vec2f(0.0, pixelStep * offset);
                let offsetDown = vec2f(0.0, -pixelStep * offset);

                let upCoord = texCoord * toInputTexCoord + offsetUp;
                let downCoord = texCoord * toInputTexCoord + offsetDown;

                let sampleUp = textureSampleLevel(inputTexture, textureSampler, upCoord, 0.0);
                let sampleDown = textureSampleLevel(inputTexture, textureSampler, downCoord, 0.0);

                // \u30AB\u30B9\u30BF\u30E0\u8272\u307E\u305F\u306F\u5143\u753B\u50CF\u306E\u8272\u3092\u4F7F\u7528
                var sampleUpRGB: vec3f;
                var sampleDownRGB: vec3f;

                if (params.useCustomColor != 0) {
                  sampleUpRGB = params.customColor.rgb;
                  sampleDownRGB = params.customColor.rgb;
                } else {
                  sampleUpRGB = sampleUp.rgb;
                  sampleDownRGB = sampleDown.rgb;
                }

                // \u30A2\u30EB\u30D5\u30A1\u5024\u306E\u8A08\u7B97
                resultAlpha += (sampleUp.a + sampleDown.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB\u5024\u306E\u8A08\u7B97\uFF08\u30A2\u30EB\u30D5\u30A1\u3067\u91CD\u307F\u4ED8\u3051\uFF09
                // \u30A2\u30EB\u30D5\u30A1\u304C0\u3067\u306A\u3051\u308C\u3070RGB\u3092\u8003\u616E
                if (sampleUp.a > 0.0) {
                  resultRGB += sampleUpRGB * weight * sampleUp.a;
                  totalWeightRGB += weight * sampleUp.a;
                }

                if (sampleDown.a > 0.0) {
                  resultRGB += sampleDownRGB * weight * sampleDown.a;
                  totalWeightRGB += weight * sampleDown.a;
                }
              }

              // \u6700\u7D42\u7684\u306A\u30A2\u30EB\u30D5\u30A1\u5024\u3092\u8A08\u7B97
              resultAlpha = resultAlpha / totalWeightAlpha;

              // RGB\u5024\u306E\u8A08\u7B97\uFF08\u30A2\u30EB\u30D5\u30A1\u91CD\u307F\u3067\u6B63\u898F\u5316\uFF09
              var finalRGB: vec3f;
              if (totalWeightRGB > 0.0) {
                finalRGB = resultRGB / totalWeightRGB;
              } else {
                // \u30A2\u30EB\u30D5\u30A1\u304C\u3059\u3079\u30660\u306A\u3089\u3001\u5143\u306E\u8272\u3092\u4F7F\u7528
                finalRGB = originalColor.rgb;
              }

              let finalColor = vec4f(finalRGB, resultAlpha);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const horizontalBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
              sparkle: f32,
              makeOriginalTransparent: i32,
              useCustomColor: i32,
              customColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var originalTexture: texture_2d<f32>;

            fn gaussianWeight(offset: f32, sigma: f32) -> f32 {
              let gaussianExp = -0.5 * (offset * offset) / (sigma * sigma);
              return exp(gaussianExp) / (2.5066282746 * sigma);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // \u5143\u753B\u50CF\u3092\u53D6\u5F97
              let originalColor = textureSampleLevel(originalTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // DPI\u30B9\u30B1\u30FC\u30EB\u3092\u8003\u616E\u3057\u305F\u30D6\u30E9\u30FC\u534A\u5F84\u3068\u30B7\u30B0\u30DE\u306E\u8A08\u7B97
              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * 0.33 * params.strength;

              if (sigma <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let intermediateColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // \u30AB\u30B9\u30BF\u30E0\u8272\u3092\u4F7F\u7528\u3059\u308B\u304B\u3069\u3046\u304B\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u8272\u3092\u6C7A\u5B9A
              var sampledRGB: vec3f;
              if (params.useCustomColor != 0) {
                // \u30AB\u30B9\u30BF\u30E0\u8272\u3092\u4F7F\u7528\u3059\u308B\u5834\u5408
                sampledRGB = params.customColor.rgb;
              } else {
                // \u5143\u753B\u50CF\u306E\u8272\u3092\u4F7F\u7528\u3059\u308B\u5834\u5408
                sampledRGB = intermediateColor.rgb;
              }

              // \u30A2\u30EB\u30D5\u30A1\u5024\u306F\u5E38\u306B\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u304B\u3089\u53D6\u5F97
              let sampledAlpha = intermediateColor.a;

              // \u30A2\u30EB\u30D5\u30A1\u3068RGB\u3092\u5206\u3051\u3066\u8A08\u7B97\u3059\u308B\u305F\u3081\u306B\u5909\u6570\u3092\u5206\u3051\u308B
              let centerWeight = gaussianWeight(0.0, sigma);

              // \u30A2\u30EB\u30D5\u30A1\u8A08\u7B97\u7528
              var totalWeightAlpha = centerWeight;
              var resultAlpha = sampledAlpha * centerWeight;

              // RGB\u8A08\u7B97\u7528\uFF08\u30A2\u30EB\u30D5\u30A1\u3067\u91CD\u307F\u4ED8\u3051\uFF09
              var totalWeightRGB = centerWeight * sampledAlpha;
              // \u30A2\u30EB\u30D5\u30A1\u304C0\u306E\u5834\u5408\u3067\u3082RGB\u5024\u3092\u4FDD\u6301\u3059\u308B\uFF08\u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u304B\u3089\u623B\u3059\uFF09
              var resultRGB: vec3f;
              if (sampledAlpha > 0.0) {
                resultRGB = sampledRGB * centerWeight * sampledAlpha;
              } else {
                // \u30A2\u30EB\u30D5\u30A1\u304C0\u306E\u5834\u5408\u306F\u5468\u56F2\u304B\u3089\u8272\u3092\u63A8\u6E2C\u3059\u308B\u305F\u3081\u521D\u671F\u5024\u306F0
                resultRGB = vec3f(0.0);
              }

              let pixelStep = 1.0 / dims.x;
              let radiusScaledInt = i32(ceil(radiusScaled));

              for (var i = 1; i <= radiusScaledInt; i = i + 1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                let offsetRight = vec2f(pixelStep * offset, 0.0);
                let offsetLeft = vec2f(-pixelStep * offset, 0.0);

                let rightCoord = texCoord * toInputTexCoord + offsetRight;
                let leftCoord = texCoord * toInputTexCoord + offsetLeft;

                let sampleRight = textureSampleLevel(inputTexture, textureSampler, rightCoord, 0.0);
                let sampleLeft = textureSampleLevel(inputTexture, textureSampler, leftCoord, 0.0);

                // \u30AB\u30B9\u30BF\u30E0\u8272\u307E\u305F\u306F\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u8272\u3092\u4F7F\u7528
                var sampleRightRGB: vec3f;
                var sampleLeftRGB: vec3f;

                if (params.useCustomColor != 0) {
                  sampleRightRGB = params.customColor.rgb;
                  sampleLeftRGB = params.customColor.rgb;
                } else {
                  sampleRightRGB = sampleRight.rgb;
                  sampleLeftRGB = sampleLeft.rgb;
                }

                // \u30A2\u30EB\u30D5\u30A1\u5024\u306E\u8A08\u7B97
                resultAlpha += (sampleRight.a + sampleLeft.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB\u5024\u306E\u8A08\u7B97\uFF08\u30A2\u30EB\u30D5\u30A1\u3067\u91CD\u307F\u4ED8\u3051\uFF09
                // \u30A2\u30EB\u30D5\u30A1\u304C0\u3067\u306A\u3051\u308C\u3070RGB\u3092\u8003\u616E
                if (sampleRight.a > 0.0) {
                  resultRGB += sampleRightRGB * weight * sampleRight.a;
                  totalWeightRGB += weight * sampleRight.a;
                }

                if (sampleLeft.a > 0.0) {
                  resultRGB += sampleLeftRGB * weight * sampleLeft.a;
                  totalWeightRGB += weight * sampleLeft.a;
                }
              }

              // \u6700\u7D42\u7684\u306A\u30A2\u30EB\u30D5\u30A1\u5024\u3092\u8A08\u7B97
              resultAlpha = resultAlpha / totalWeightAlpha;

              // RGB\u5024\u306E\u8A08\u7B97\uFF08\u30A2\u30EB\u30D5\u30A1\u91CD\u307F\u3067\u6B63\u898F\u5316\uFF09
              var finalRGB: vec3f;
              if (totalWeightRGB > 0.0) {
                finalRGB = resultRGB / totalWeightRGB;
              } else {
                // \u30A2\u30EB\u30D5\u30A1\u304C\u3059\u3079\u30660\u306A\u3089\u3001\u5143\u306E\u8272\u3092\u4F7F\u7528
                finalRGB = intermediateColor.rgb;
              }

              // \u57FA\u672C\u7684\u306A\u30D6\u30E9\u30FC\u7D50\u679C
              let blurColor = vec4f(finalRGB, resultAlpha);

              // \u304D\u3089\u3081\u304D\u52B9\u679C\u3092\u9069\u7528\uFF08\u5024\u3092\u6700\u59272\u500D\u307E\u3067\u5897\u5E45\uFF09
              let sparkleMultiplier = 1.0 + params.sparkle;
              let sparkledColor = vec4f(blurColor.rgb * sparkleMultiplier, blurColor.a);

              // \u5143\u753B\u50CF\u306E\u900F\u660E\u5EA6\u306B\u57FA\u3065\u3044\u3066\u5408\u6210
              // \u5143\u753B\u50CF\u304C\u4E0D\u900F\u660E\u306A\u90E8\u5206\u307B\u3069\u5143\u753B\u50CF\u306E\u8272\u3092\u4F7F\u7528
              let blendFactor = originalColor.a;
              let blendedRGB = mix(sparkledColor.rgb, originalColor.rgb, blendFactor);

                              // \u300C\u5143\u753B\u50CF\u3092\u900F\u660E\u306B\u3059\u308B\u300D\u8A2D\u5B9A\u306B\u57FA\u3065\u3044\u3066\u30A2\u30EB\u30D5\u30A1\u3092\u8ABF\u6574
              var resultColor: vec4f;
              if (params.makeOriginalTransparent != 0) {
                // \u5408\u6210\u3057\u305FRGB\u3092\u4F7F\u7528\u3057\u3001\u5143\u753B\u50CF\u304C\u4E0D\u900F\u660E\u3060\u3063\u305F\u90E8\u5206\u306E\u30A2\u30EB\u30D5\u30A1\u30920\u306B
                let resultAlpha = select(sparkledColor.a, 0.0, originalColor.a > 0.0);
                resultColor = vec4f(blendedRGB, resultAlpha);
              } else {
                // \u901A\u5E38\u306E\u5408\u6210\uFF1A\u5143\u753B\u50CF\u306E\u4E0D\u900F\u660E\u90E8\u5206\u306F\u5143\u753B\u50CF\u306E\u8272\u3001\u900F\u660E\u90E8\u5206\u306F\u30D6\u30E9\u30FC+\u304D\u3089\u3081\u304D\u52B9\u679C
                resultColor = vec4f(blendedRGB, max(originalColor.a, sparkledColor.a));
              }

              // \u7D50\u679C\u306F0.0\uFF5E1.0\u306E\u7BC4\u56F2\u306B\u5236\u9650
              resultColor = clamp(resultColor, vec4f(0.0), vec4f(1.0));

              textureStore(resultTexture, id.xy, resultColor);
            }
          `;
          const verticalShader = device.createShaderModule({
            label: "Kirakira Blur Vertical Shader",
            code: verticalBlurCode
          });
          const horizontalShader = device.createShaderModule({
            label: "Kirakira Blur Horizontal Shader",
            code: horizontalBlurCode
          });
          const verticalPipelineDef = makeShaderDataDefinitions3(verticalBlurCode);
          const horizontalPipelineDef = makeShaderDataDefinitions3(horizontalBlurCode);
          const verticalPipeline = device.createComputePipeline({
            label: "Kirakira Blur Vertical Pipeline",
            layout: "auto",
            compute: {
              module: verticalShader,
              entryPoint: "computeMain"
            }
          });
          const horizontalPipeline = device.createComputePipeline({
            label: "Kirakira Blur Horizontal Pipeline",
            layout: "auto",
            compute: {
              module: horizontalShader,
              entryPoint: "computeMain"
            }
          });
          return {
            device,
            verticalPipeline,
            horizontalPipeline,
            verticalPipelineDef,
            horizontalPipelineDef
          };
        }
      );
    },
    goLiveEffect: async ({
      device,
      verticalPipeline,
      horizontalPipeline,
      verticalPipelineDef,
      horizontalPipelineDef
    }, params, imgData, { dpi, baseDpi }) => {
      console.log("Kirakira Blur V1", params);
      const dpiRatio = dpi / baseDpi;
      const paddingSize = Math.ceil(params.radius * dpiRatio);
      imgData = await paddingImageData(imgData, paddingSize);
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const inputTexture = device.createTexture({
        label: "Kirakira Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const intermediateTexture = device.createTexture({
        label: "Kirakira Blur Intermediate Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Kirakira Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Kirakira Blur Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const verticalUniformValues = makeStructuredView3(
        verticalPipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Kirakira Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const horizontalUniformValues = makeStructuredView3(
        horizontalPipelineDef.uniforms.params
      );
      const horizontalUniformBuffer = device.createBuffer({
        label: "Kirakira Blur Horizontal Params Buffer",
        size: horizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      verticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
        sparkle: params.sparkle,
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a
        ]
      });
      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
        sparkle: params.sparkle,
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a
        ]
      });
      device.queue.writeBuffer(
        verticalUniformBuffer,
        0,
        verticalUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        horizontalUniformBuffer,
        0,
        horizontalUniformValues.arrayBuffer
      );
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const verticalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Vertical Bind Group",
        layout: verticalPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: verticalUniformBuffer }
          }
        ]
      });
      const horizontalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Horizontal Bind Group",
        layout: horizontalPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: intermediateTexture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: horizontalUniformBuffer }
          },
          {
            binding: 4,
            resource: inputTexture.createView()
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      const commandEncoder = device.createCommandEncoder({
        label: "Kirakira Blur Command Encoder"
      });
      const verticalPass = commandEncoder.beginComputePass({
        label: "Kirakira Blur Vertical Pass"
      });
      verticalPass.setPipeline(verticalPipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      verticalPass.end();
      const horizontalPass = commandEncoder.beginComputePass({
        label: "Kirakira Blur Horizontal Pass"
      });
      horizontalPass.setPipeline(horizontalPipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      horizontalPass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/dithering.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions4,
  makeStructuredView as makeStructuredView4
} from "npm:webgpu-utils";
var t4 = createTranslator({
  en: {
    title: "Dithering V1",
    patternType: "Pattern Type",
    bayer2x2: "2x2 Bayer",
    bayer4x4: "4x4 Bayer",
    bayer8x8: "8x8 Bayer",
    threshold: "Threshold",
    colorMode: "Color Mode",
    monochrome: "Monochrome",
    color: "Color",
    strength: "Strength",
    patternScale: "Pattern Scale"
  },
  ja: {
    title: "\u30C7\u30A3\u30B6\u30EA\u30F3\u30B0 V1",
    patternType: "\u30D1\u30BF\u30FC\u30F3\u30BF\u30A4\u30D7",
    bayer2x2: "2x2 Bayer",
    bayer4x4: "4x4 Bayer",
    bayer8x8: "8x8 Bayer",
    threshold: "\u3057\u304D\u3044\u5024",
    colorMode: "\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9",
    monochrome: "\u30E2\u30CE\u30AF\u30ED",
    color: "\u30AB\u30E9\u30FC",
    strength: "\u5F37\u5EA6",
    patternScale: "\u30D1\u30BF\u30FC\u30F3\u30B9\u30B1\u30FC\u30EB"
  }
});
var dithering = definePlugin({
  id: "dithering-v1",
  title: t4("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      patternType: {
        type: "string",
        enum: ["bayer2x2", "bayer4x4", "bayer8x8"],
        default: "bayer4x4"
      },
      threshold: {
        type: "real",
        default: 50
      },
      colorMode: {
        type: "string",
        enum: ["monochrome", "color"],
        default: "color"
      },
      strength: {
        type: "real",
        default: 100
      },
      patternScale: {
        type: "real",
        default: 1
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        threshold: params.threshold,
        strength: params.strength,
        patternType: params.patternType,
        colorMode: params.colorMode,
        patternScale: params.patternScale
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t22),
        strength: lerp(paramsA.strength, paramsB.strength, t22),
        patternType: t22 < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t22 < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        patternScale: lerp(paramsA.patternScale, paramsB.patternScale, t22)
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: "float", min: 0, max: 100, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: "float", min: 0, max: 100, step: 0.1, value: params.strength })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("patternType") }),
          ui.select({ key: "patternType", value: params.patternType, options: [
            { value: "bayer2x2", label: "2x2 Bayer" },
            { value: "bayer4x4", label: "4x4 Bayer" },
            { value: "bayer8x8", label: "8x8 Bayer" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("patternScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "patternScale", dataType: "float", min: 0.25, max: 4, value: params.patternScale }),
            ui.numberInput({ key: "patternScale", dataType: "float", min: 0.25, max: 4, step: 0.05, value: params.patternScale })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("threshold") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "threshold", dataType: "float", min: 0, max: 100, value: params.threshold }),
            ui.numberInput({ key: "threshold", dataType: "float", min: 0, max: 100, step: 0.1, value: params.threshold })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            { value: "monochrome", label: t4("monochrome") },
            { value: "color", label: t4("color") }
          ] })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: {
            label: "Device (Dithering)"
          }
        },
        (device) => {
          const ditherPatterns = {
            bayer2x2: {
              data: new Uint8Array([
                0,
                0,
                0,
                255,
                128,
                128,
                128,
                255,
                192,
                192,
                192,
                255,
                64,
                64,
                64,
                255
              ]),
              width: 2,
              height: 2
            },
            bayer4x4: {
              data: new Uint8Array([
                0,
                0,
                0,
                255,
                128,
                128,
                128,
                255,
                32,
                32,
                32,
                255,
                160,
                160,
                160,
                255,
                192,
                192,
                192,
                255,
                64,
                64,
                64,
                255,
                224,
                224,
                224,
                255,
                96,
                96,
                96,
                255,
                48,
                48,
                48,
                255,
                176,
                176,
                176,
                255,
                16,
                16,
                16,
                255,
                144,
                144,
                144,
                255,
                240,
                240,
                240,
                255,
                112,
                112,
                112,
                255,
                208,
                208,
                208,
                255,
                80,
                80,
                80,
                255
              ]),
              width: 4,
              height: 4
            },
            bayer8x8: {
              data: new Uint8Array([
                0,
                0,
                0,
                255,
                128,
                128,
                128,
                255,
                32,
                32,
                32,
                255,
                160,
                160,
                160,
                255,
                8,
                8,
                8,
                255,
                136,
                136,
                136,
                255,
                40,
                40,
                40,
                255,
                168,
                168,
                168,
                255,
                192,
                192,
                192,
                255,
                64,
                64,
                64,
                255,
                224,
                224,
                224,
                255,
                96,
                96,
                96,
                255,
                200,
                200,
                200,
                255,
                72,
                72,
                72,
                255,
                232,
                232,
                232,
                255,
                104,
                104,
                104,
                255,
                48,
                48,
                48,
                255,
                176,
                176,
                176,
                255,
                16,
                16,
                16,
                255,
                144,
                144,
                144,
                255,
                56,
                56,
                56,
                255,
                184,
                184,
                184,
                255,
                24,
                24,
                24,
                255,
                152,
                152,
                152,
                255,
                240,
                240,
                240,
                255,
                112,
                112,
                112,
                255,
                208,
                208,
                208,
                255,
                80,
                80,
                80,
                255,
                248,
                248,
                248,
                255,
                120,
                120,
                120,
                255,
                216,
                216,
                216,
                255,
                88,
                88,
                88,
                255,
                12,
                12,
                12,
                255,
                140,
                140,
                140,
                255,
                44,
                44,
                44,
                255,
                172,
                172,
                172,
                255,
                4,
                4,
                4,
                255,
                132,
                132,
                132,
                255,
                36,
                36,
                36,
                255,
                164,
                164,
                164,
                255,
                204,
                204,
                204,
                255,
                76,
                76,
                76,
                255,
                236,
                236,
                236,
                255,
                108,
                108,
                108,
                255,
                196,
                196,
                196,
                255,
                68,
                68,
                68,
                255,
                228,
                228,
                228,
                255,
                100,
                100,
                100,
                255,
                60,
                60,
                60,
                255,
                188,
                188,
                188,
                255,
                28,
                28,
                28,
                255,
                156,
                156,
                156,
                255,
                52,
                52,
                52,
                255,
                180,
                180,
                180,
                255,
                20,
                20,
                20,
                255,
                148,
                148,
                148,
                255,
                252,
                252,
                252,
                255,
                124,
                124,
                124,
                255,
                220,
                220,
                220,
                255,
                92,
                92,
                92,
                255,
                244,
                244,
                244,
                255,
                116,
                116,
                116,
                255,
                212,
                212,
                212,
                255,
                84,
                84,
                84,
                255
              ]),
              width: 8,
              height: 8
            }
          };
          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              threshold: f32,
              strength: f32,
              patternType: u32,  // 0: bayer2x2, 1: bayer4x4, 2: bayer8x8
              colorMode: u32,    // 0: monochrome, 1: color
              patternScale: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var inputTextureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var ditherPatternTexture: texture_2d<f32>;
            @group(0) @binding(5) var patternTextureSampler: sampler;

            // Convert RGB to grayscale
            fn rgbToGrayscale(color: vec3f) -> f32 {
              return dot(color, vec3f(0.299, 0.587, 0.114));
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Get original color
              let originalColor = textureSampleLevel(inputTexture, inputTextureSampler, texCoord * toInputTexCoord, 0.0);

              let patternDims = vec2f(textureDimensions(ditherPatternTexture));
              // Apply pattern scale to coordinates
              let patternCoord = vec2f(id.xy) / (params.dpiScale * params.patternScale);

              let patternTexCoord = vec2f(patternCoord.x % patternDims.x, patternCoord.y % patternDims.y) / patternDims;
              let bayerValue = textureSampleLevel(ditherPatternTexture, patternTextureSampler, patternTexCoord, 0.0).r;

              // Apply threshold and create dithering effect
              var finalColor: vec4f;

              if (params.colorMode == 0u) {
                // Monochrome mode
                let gray = rgbToGrayscale(originalColor.rgb);
                let thresholdValue = params.threshold;

                // If gray value is above threshold, no dots (white)
                // Otherwise apply dithering pattern
                let dithered = select(step(bayerValue, gray), 1.0, gray >= thresholdValue);
                finalColor = vec4f(vec3f(dithered), originalColor.a);
              } else {
                // Color mode
                let thresholdValue = params.threshold;

                // For each color channel, if value is above threshold, no dots
                // Otherwise apply dithering pattern
                let ditheredR = select(step(bayerValue, originalColor.r), 1.0, originalColor.r >= thresholdValue);
                let ditheredG = select(step(bayerValue, originalColor.g), 1.0, originalColor.g >= thresholdValue);
                let ditheredB = select(step(bayerValue, originalColor.b), 1.0, originalColor.b >= thresholdValue);
                finalColor = vec4f(ditheredR, ditheredG, ditheredB, originalColor.a);
              }

              // Blend with original based on strength
              finalColor = mix(originalColor, finalColor, params.strength);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Dithering Effect Shader",
            code
          });
          const defs = makeShaderDataDefinitions4(code);
          const pipeline = device.createComputePipeline({
            label: "Dithering Effect Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, defs, ditherPatterns };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, defs, ditherPatterns }, params, imgData, { baseDpi, dpi }) => {
      console.log("Dithering Effect V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const selectedPattern = ditherPatterns[params.patternType];
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const patternTexture = device.createTexture({
        label: "Dither Pattern Texture",
        size: [selectedPattern.width, selectedPattern.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const inputTextureSampler = device.createSampler({
        label: "Input Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const patternTextureSampler = device.createSampler({
        label: "Pattern Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "repeat",
        addressModeV: "repeat"
      });
      const uniformData = makeStructuredView4(defs.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformData.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformData.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        // DPIスケールを正しく設定
        threshold: params.threshold / 100,
        strength: params.strength / 100,
        patternType: (
          // prettier-ignore
          params.patternType === "bayer2x2" ? 0 : params.patternType === "bayer4x4" ? 1 : params.patternType === "bayer8x8" ? 2 : 0
        ),
        colorMode: params.colorMode === "monochrome" ? 0 : 1,
        patternScale: params.patternScale
      });
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: inputTextureSampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          },
          {
            binding: 4,
            resource: patternTexture.createView()
          },
          {
            binding: 5,
            resource: patternTextureSampler
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformData.arrayBuffer);
      device.queue.writeTexture(
        { texture: patternTexture },
        selectedPattern.data,
        { bytesPerRow: selectedPattern.width * 4 },
        [selectedPattern.width, selectedPattern.height]
      );
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Dithering Effect Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/glitch.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions5,
  makeStructuredView as makeStructuredView5
} from "npm:webgpu-utils";
var t5 = createTranslator({
  en: {
    title: "Glitch Effect V1",
    intensity: "Intensity",
    slices: "Slices",
    colorShift: "Color Shift",
    angle: "Angle",
    bias: "Direction Bias",
    seed: "Seed",
    reset: "Reset"
  },
  ja: {
    title: "\u30B0\u30EA\u30C3\u30C1\u30A8\u30D5\u30A7\u30AF\u30C8 V1",
    intensity: "\u5F37\u5EA6",
    slices: "\u30B9\u30E9\u30A4\u30B9\u6570",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    angle: "\u89D2\u5EA6",
    bias: "\u6563\u5E03\u306E\u5BC4\u308A",
    seed: "\u30B7\u30FC\u30C9\u5024",
    reset: "\u30EA\u30BB\u30C3\u30C8"
  }
});
var glitch = definePlugin({
  id: "glitch-effect-v1",
  title: t5("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 0.5
      },
      slices: {
        type: "int",
        default: 20
      },
      colorShift: {
        type: "real",
        default: 1
      },
      angle: {
        type: "real",
        default: 0
      },
      bias: {
        type: "real",
        default: 0
      },
      seed: {
        type: "int",
        default: Math.floor(Math.random() * 1e4)
      }
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onEditParameters: (params) => {
      params.intensity = Math.max(0, Math.min(1, params.intensity));
      params.colorShift = Math.max(0, Math.min(1, params.colorShift));
      params.angle = Math.max(-1, Math.min(1, params.angle));
      params.bias = Math.max(-1, Math.min(1, params.bias));
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t22),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t22),
        slices: Math.round(lerp(paramsA.slices, paramsB.slices, t22)),
        angle: lerp(paramsA.angle, paramsB.angle, t22),
        bias: lerp(paramsA.bias, paramsB.bias, t22),
        seed: paramsA.seed
        // シード値は補間しない
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("intensity") }),
          ui.slider({ key: "intensity", dataType: "float", min: 0, max: 1, value: params.intensity })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("slices") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "slices", dataType: "int", min: 1, max: 400, value: params.slices }),
            ui.numberInput({ dataType: "int", key: "slices", value: params.slices, min: 1, max: 400, step: 1 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 100, value: params.colorShift }),
            ui.numberInput({ dataType: "float", key: "colorShift", value: params.colorShift, min: 0, max: 1, step: 0.01 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angle", dataType: "float", min: -1, max: 1, value: params.angle }),
            ui.numberInput({ dataType: "float", key: "angle", value: params.angle, min: -1, max: 1, step: 0.01 })
          ]),
          ui.button({ text: t5("reset"), onClick: () => {
            setParam({ angle: 0 });
          } })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("bias") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bias", dataType: "float", min: -1, max: 1, value: params.bias }),
            ui.numberInput({ dataType: "float", key: "bias", value: params.bias, min: -1, max: 1, step: 0.01 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t5("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: "int", min: 0, max: 1e4, value: params.seed }),
            ui.numberInput({ dataType: "int", key: "seed", value: params.seed, min: 0, max: 1e4, step: 1 })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, (device) => {
        const code = `
          struct Params {
            intensity: f32,
            colorShift: f32,
            slices: f32,
            angle: f32,
            bias: f32,
            seed: f32,
            dpi: i32,
            baseDpi: i32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = textureDimensions(inputTexture);
            if (id.x >= dims.x || id.y >= dims.y) {
              return;
            }

            let texCoord = vec2f(id.xy) / vec2f(dims);
            var outColor: vec4f;

            var shiftedCoord = texCoord;

            if (params.intensity > 0.0) {
              // \u89D2\u5EA6\u306B\u57FA\u3065\u3044\u3066\u659C\u3081\u306E\u30B9\u30E9\u30A4\u30B9\u3092\u8A08\u7B97
              let angle = params.angle * 3.14159;

              // x\u3068y\u306E\u5EA7\u6A19\u3092\u89D2\u5EA6\u306B\u57FA\u3065\u3044\u3066\u56DE\u8EE2\u3055\u305B\u305F\u5EA7\u6A19\u3067\u30B9\u30E9\u30A4\u30B9\u3092\u6C7A\u5B9A
              let sliceCoord = texCoord.x * sin(angle) + texCoord.y * cos(angle);
              let sliceIndex = floor(sliceCoord * params.slices);

              let seed = params.seed;
              let random = fract(sin(sliceIndex * 43758.5453 + seed) * 43758.5453);

              if (random < params.intensity) {
                let shift = (random - 0.5 + params.bias * 0.5) * params.intensity;

                // \u30B7\u30D5\u30C8\u65B9\u5411\u3082\u89D2\u5EA6\u306B\u5782\u76F4\u306A\u65B9\u5411\u306B
                let shiftAngle = angle;
                let xShift = shift * cos(shiftAngle);
                let yShift = shift * sin(shiftAngle);

                shiftedCoord.x = clamp(texCoord.x + xShift, 0.0, 1.0);
                shiftedCoord.y = clamp(texCoord.y + yShift, 0.0, 1.0);
              }
            }

            let rOffset = params.colorShift;

            let rCoord = clamp(vec2f(shiftedCoord.x + rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));
            let gCoord = shiftedCoord;
            let bCoord = clamp(vec2f(shiftedCoord.x - rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));

            let rC = textureSampleLevel(inputTexture, textureSampler, rCoord, 0.0);
            let gC = textureSampleLevel(inputTexture, textureSampler, gCoord, 0.0);
            let bC = textureSampleLevel(inputTexture, textureSampler, bCoord, 0.0);

            let a = (rC.a + gC.a + bC.a) / 3.0;

            outColor = vec4f(rC.r, gC.g, bC.b, a);

            textureStore(resultTexture, id.xy, outColor);
          }
        `;
        const shader = device.createShaderModule({
          code
        });
        const defs = makeShaderDataDefinitions5(code);
        const pipeline = device.createComputePipeline({
          compute: {
            module: shader,
            entryPoint: "computeMain"
          },
          layout: "auto"
        });
        return { pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      imgData = await paddingImageData(
        imgData,
        params.colorShift + params.bias
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width;
      const inputHeight = imgData.height;
      const uniformValues = makeStructuredView5(defs.uniforms.params);
      const texture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const resultTexture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
      });
      const sampler = device.createSampler({
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformBuffer = device.createBuffer({
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        intensity: params.intensity,
        colorShift: params.colorShift / 100,
        slices: Math.max(1, params.slices),
        angle: params.angle,
        bias: params.bias,
        seed: params.seed,
        dpi: env.dpi,
        baseDpi: env.baseDpi
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: resultTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: uniformBuffer } }
        ]
      });
      const stagingBuffer = device.createBuffer({
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      const workgroupsX = Math.ceil(inputWidth / 16);
      const workgroupsY = Math.ceil(inputHeight / 16);
      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      const commandBuffer = commandEncoder.finish();
      device.queue.submit([commandBuffer]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      const finalImage = await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
      return finalImage;
    }
  }
});

// src/js/src/live-effects/outline.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions6,
  makeStructuredView as makeStructuredView6
} from "npm:webgpu-utils";
var t6 = createTranslator({
  en: {
    title: "Outline Effect (Morphology)",
    size: "Size",
    color: "Color"
  },
  ja: {
    title: "\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u30A8\u30D5\u30A7\u30AF\u30C8 (\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC)",
    size: "\u592A\u3055",
    color: "\u8272"
  }
});
var outline = definePlugin({
  id: "outline-effect-morphology-v1",
  title: t6("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      size: {
        type: "real",
        default: 3
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        size: Math.max(0.1, params.size)
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        color: adjustColor(params.color)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t22),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t22),
          g: lerp(paramsA.color.g, paramsB.color.g, t22),
          b: lerp(paramsA.color.b, paramsB.color.b, t22),
          a: lerp(paramsA.color.a, paramsB.color.a, t22)
        }
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.text({ text: t6("size") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.1,
            max: 200,
            value: params.size
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size
          })
        ]),
        ui.colorInput({ key: "color", value: params.color })
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Outline Effect Morphology)" }
        },
        (device) => {
          const boundaryShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              size: f32,
              color: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var intermediateTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn isTransparent(color: vec4f) -> bool {
              return color.a < 0.01;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let adjustedDims = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / adjustedDims;

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

                // DPI\u5BFE\u5FDC\u306E\u30B5\u30A4\u30BA\u8A08\u7B97
                let scaledSize = params.size * params.dpiScale;

                // \u73FE\u5728\u306E\u30D4\u30AF\u30BB\u30EB\u306E\u900F\u660E\u6027
                let isCurrentTransparent = isTransparent(originalColor);

                var outlineIntensity = 0.0;

                if (scaledSize > 0.0) {
                    let stepSize = 1.0 / dims;
                    // \u6700\u5927\u8DDD\u96E2\u306F\u7DDA\u306E\u592A\u3055\u306B\u57FA\u3065\u304F
                    let maxDist = scaledSize * 1.5;

                    // \u653E\u5C04\u72B6\u306B\u65B9\u5411\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u3057\u3066\u5883\u754C\u3092\u691C\u51FA
                    let dirCount = 32u; // \u3088\u308A\u591A\u304F\u306E\u65B9\u5411\u3092\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                    let angleStep = 3.14159 * 2.0 / f32(dirCount);

                    for (var i = 0u; i < dirCount; i = i + 1u) {
                        let angle = f32(i) * angleStep;
                        let dir = vec2f(cos(angle), sin(angle));

                        var foundBoundary = false;
                        var boundaryDist = maxDist;

                        // \u3088\u308A\u7D30\u304B\u3044\u30B9\u30C6\u30C3\u30D7\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                        let samplingStep = 0.3; // \u3088\u308A\u7D30\u304B\u3044\u30B9\u30C6\u30C3\u30D7
                        for (var dist = 0.5; dist <= maxDist; dist += samplingStep) {
                            let offset = dir * stepSize * dist;
                            let sampleCoord = texCoord * toInputTexCoord + offset;

                            // \u753B\u50CF\u306E\u7BC4\u56F2\u5916\u306F\u30B9\u30AD\u30C3\u30D7
                            if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                                sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                                continue;
                            }

                            let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);
                            let isSampleTransparent = isTransparent(sampleColor);

                            // \u900F\u660E\u6027\u304C\u7570\u306A\u308C\u3070\u5883\u754C\u3092\u691C\u51FA
                            if (isSampleTransparent != isCurrentTransparent) {
                                foundBoundary = true;
                                boundaryDist = dist;
                                break;
                            }
                        }

                        if (foundBoundary) {
                            // \u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u306E\u5F37\u5EA6\u8A08\u7B97\uFF1A\u5883\u754C\u306B\u8FD1\u3044\u307B\u3069\u5F37\u304F
                            let t = 1.0 - boundaryDist / scaledSize;
                            outlineIntensity = max(outlineIntensity, clamp(t, 0.0, 1.0));
                        }
                    }
                }

                // \u7D50\u679C\u3092\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u306B\u4FDD\u5B58
                // r: \u900F\u660E\u6027\u30D5\u30E9\u30B0\uFF081.0\u306F\u4E0D\u900F\u660E\u30010.0\u306F\u900F\u660E\uFF09
                // g: \u672A\u4F7F\u7528
                // b: \u672A\u4F7F\u7528
                // a: \u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u5F37\u5EA6
                var transparencyFlag = 0.0;
                if (!isCurrentTransparent) {
                    transparencyFlag = 1.0;
                }

                textureStore(
                  intermediateTexture,
                  id.xy,
                  vec4f(transparencyFlag, 0.0, 0.0, outlineIntensity)
                );
            }
          `;
          const morphologyShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              size: f32,
              color: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var intermediateTexture: texture_2d<f32>;
            @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(3) var textureSampler: sampler;
            @group(0) @binding(4) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let adjustedDims = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / adjustedDims;

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                // \u5143\u306E\u753B\u50CF\u3068\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u304B\u3089\u60C5\u5831\u3092\u53D6\u5F97
                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
                let intermediateValue = textureSampleLevel(intermediateTexture, textureSampler, texCoord, 0.0);

                // \u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u60C5\u5831\u3092\u5206\u89E3
                var isCurrentOpaque = false;
                if (intermediateValue.r > 0.5) {
                    isCurrentOpaque = true;
                }
                let outlineIntensity = intermediateValue.a;

                // DPI\u5BFE\u5FDC\u306E\u30B5\u30A4\u30BA\u8A08\u7B97
                let scaledSize = params.size * params.dpiScale;

                // \u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\u6F14\u7B97\u306E\u305F\u3081\u306E\u69CB\u9020\u5316\u8981\u7D20\uFF08\u30AB\u30FC\u30CD\u30EB\uFF09\u30B5\u30A4\u30BA
                var kernelSize = 4;

                // \u30B9\u30C6\u30C3\u30D71: \u62E1\u5F35\u64CD\u4F5C\uFF08Dilation\uFF09
                // \u3053\u308C\u306B\u3088\u308A\u5C0F\u3055\u306A\u7A74\u3084\u51F9\u307F\u304C\u57CB\u307E\u308A\u307E\u3059
                var dilatedValue = 0.0;

                for (var dy = -kernelSize; dy <= kernelSize; dy += 1) {
                    for (var dx = -kernelSize; dx <= kernelSize; dx += 1) {
                        let offset = vec2f(f32(dx), f32(dy)) / dims;
                        let sampleCoord = texCoord + offset;

                        // \u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u7BC4\u56F2\u5916\u30C1\u30A7\u30C3\u30AF
                        if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                            sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                            continue;
                        }

                        // \u69CB\u9020\u5316\u8981\u7D20\uFF08\u5186\u5F62\u30AB\u30FC\u30CD\u30EB\uFF09\u306E\u6761\u4EF6
                        let dist = length(vec2f(f32(dx), f32(dy)));
                        if (dist > f32(kernelSize)) {
                            continue;
                        }

                        let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                        dilatedValue = max(dilatedValue, sampleValue.a);
                    }
                }

                // \u30B9\u30C6\u30C3\u30D72: \u53CE\u7E2E\u64CD\u4F5C\uFF08Erosion\uFF09
                // \u3053\u308C\u306B\u3088\u308A\u7A81\u8D77\u3084\u30AE\u30B6\u30AE\u30B6\u304C\u524A\u3089\u308C\u307E\u3059
                var erodedValue = 1.0;

                // \u53CE\u7E2E\u30AB\u30FC\u30CD\u30EB\u306F\u62E1\u5F35\u3088\u308A\u5C11\u3057\u5C0F\u3055\u304F
                let erosionKernelSize = max(1, kernelSize - 1);

                for (var dy = -erosionKernelSize; dy <= erosionKernelSize; dy += 1) {
                    for (var dx = -erosionKernelSize; dx <= erosionKernelSize; dx += 1) {
                        let offset = vec2f(f32(dx), f32(dy)) / dims;
                        let sampleCoord = texCoord + offset;

                        // \u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u7BC4\u56F2\u5916\u306F\u6700\u5C0F\u5024\u3068\u307F\u306A\u3059
                        if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                            sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                            erodedValue = 0.0;
                            continue;
                        }

                        // \u69CB\u9020\u5316\u8981\u7D20\uFF08\u5186\u5F62\u30AB\u30FC\u30CD\u30EB\uFF09\u306E\u6761\u4EF6
                        let dist = length(vec2f(f32(dx), f32(dy)));
                        if (dist > f32(erosionKernelSize)) {
                            continue;
                        }

                        // \u62E1\u5F35\u6E08\u307F\u5024\u3092\u4F7F\u7528\u3057\u3066\u53CE\u7E2E
                        let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                        erodedValue = min(erodedValue, sampleValue.a);
                    }
                }

                // \u6700\u7D42\u7684\u306A\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\u51E6\u7406\u7D50\u679C
                // \u307E\u305A\u62E1\u5F35\u3057\u3066\u304B\u3089\u53CE\u7E2E\u3059\u308B\u306E\u3067\u30AF\u30ED\u30FC\u30BA\u64CD\u4F5C\uFF08Close\uFF09\u306B\u306A\u308B
                var morphValue = 0.0;

                // \u7DDA\u306E\u592A\u3055\u306B\u5FDC\u3058\u3066\u6319\u52D5\u3092\u8ABF\u6574
                if (scaledSize < 5.0) {
                    // \u7D30\u3044\u7DDA\u306F\u5143\u306E\u5024\u3092\u307B\u307C\u7DAD\u6301\uFF08\u8EFD\u5FAE\u306A\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\uFF09
                    morphValue = mix(outlineIntensity, dilatedValue, 0.5);
                } else {
                    // \u592A\u3044\u7DDA\u306F\u30D5\u30EB\u51E6\u7406\uFF08\u30AF\u30ED\u30FC\u30BA\u64CD\u4F5C\uFF09
                    morphValue = erodedValue;
                }

                // \u95BE\u5024\u51E6\u7406\u3067\u30D0\u30A4\u30CA\u30EA\u30DE\u30B9\u30AF\u751F\u6210
                var binaryMask = 0.0;
                let threshold = 0.3;
                if (morphValue >= threshold) {
                    binaryMask = 1.0;
                }

                // \u6700\u7D42\u7684\u306A\u6ED1\u3089\u304B\u3055\u3092\u308F\u305A\u304B\u306B\u8FFD\u52A0
                var finalMask = binaryMask;

                // \u7D50\u679C\u306E\u5408\u6210
                var finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
                if (originalColor.a > 0.01) {
                    // \u4E0D\u900F\u660E\u90E8\u5206\u306F\u5143\u306E\u753B\u50CF\u3092\u8868\u793A\uFF08\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u3092\u4E0A\u66F8\u304D\uFF09
                    finalColor = originalColor;
                } else {
                    // \u900F\u660E\u90E8\u5206\u306F\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u3092\u8868\u793A
                    finalColor = vec4f(
                      params.color.r,
                      params.color.g,
                      params.color.b,
                      finalMask * params.color.a
                    );
                }

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const boundaryShader = device.createShaderModule({
            label: "Outline Boundary Detection Shader",
            code: boundaryShaderCode
          });
          const morphologyShader = device.createShaderModule({
            label: "Outline Morphology Shader",
            code: morphologyShaderCode
          });
          const boundaryPipelineDef = makeShaderDataDefinitions6(boundaryShaderCode);
          const morphologyPipelineDef = makeShaderDataDefinitions6(morphologyShaderCode);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const boundaryPipeline = device.createComputePipeline({
            label: "Outline Boundary Pipeline",
            layout: "auto",
            compute: {
              module: boundaryShader,
              entryPoint: "computeMain"
            }
          });
          const morphologyPipeline = device.createComputePipeline({
            label: "Outline Morphology Pipeline",
            layout: "auto",
            compute: {
              module: morphologyShader,
              entryPoint: "computeMain"
            }
          });
          return {
            device,
            boundaryPipeline,
            morphologyPipeline,
            boundaryPipelineDef,
            morphologyPipelineDef
          };
        }
      );
    },
    goLiveEffect: async ({
      device,
      boundaryPipeline,
      morphologyPipeline,
      boundaryPipelineDef,
      morphologyPipelineDef
    }, params, imgData, { dpi, baseDpi }) => {
      console.log("Outline Effect Morphology V1", params);
      const dpiScale = dpi / baseDpi;
      const padding = Math.ceil(params.size * dpiScale);
      imgData = await paddingImageData(imgData, padding);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const inputTexture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const intermediateTexture = device.createTexture({
        label: "Intermediate Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const boundaryUniformValues = makeStructuredView6(
        boundaryPipelineDef.uniforms.params
      );
      const boundaryUniformBuffer = device.createBuffer({
        label: "Boundary Params Buffer",
        size: boundaryUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const morphologyUniformValues = makeStructuredView6(
        morphologyPipelineDef.uniforms.params
      );
      const morphologyUniformBuffer = device.createBuffer({
        label: "Morphology Params Buffer",
        size: morphologyUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const boundaryBindGroup = device.createBindGroup({
        label: "Boundary Detection Bind Group",
        layout: boundaryPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: boundaryUniformBuffer }
          }
        ]
      });
      const morphologyBindGroup = device.createBindGroup({
        label: "Morphology Bind Group",
        layout: morphologyPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
          },
          {
            binding: 2,
            resource: resultTexture.createView()
          },
          {
            binding: 3,
            resource: sampler
          },
          {
            binding: 4,
            resource: { buffer: morphologyUniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      boundaryUniformValues.set({
        outputSize: [inputWidth, inputHeight],
        dpiScale,
        size: params.size,
        color: [params.color.r, params.color.g, params.color.b, params.color.a]
      });
      device.queue.writeBuffer(
        boundaryUniformBuffer,
        0,
        boundaryUniformValues.arrayBuffer
      );
      morphologyUniformValues.set({
        outputSize: [inputWidth, inputHeight],
        dpiScale,
        size: params.size,
        color: [params.color.r, params.color.g, params.color.b, params.color.a]
      });
      device.queue.writeBuffer(
        morphologyUniformBuffer,
        0,
        morphologyUniformValues.arrayBuffer
      );
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Morphology Outline Command Encoder"
      });
      const boundaryPass = commandEncoder.beginComputePass({
        label: "Boundary Detection Compute Pass"
      });
      boundaryPass.setPipeline(boundaryPipeline);
      boundaryPass.setBindGroup(0, boundaryBindGroup);
      boundaryPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      boundaryPass.end();
      const morphologyPass = commandEncoder.beginComputePass({
        label: "Morphology Compute Pass"
      });
      morphologyPass.setPipeline(morphologyPipeline);
      morphologyPass.setBindGroup(0, morphologyBindGroup);
      morphologyPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      morphologyPass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/coastic.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions7,
  makeStructuredView as makeStructuredView7
} from "npm:webgpu-utils";
var t7 = createTranslator({
  en: {
    title: "Caustics",
    intensity: "Intensity",
    scale: "Scale",
    complexity: "Complexity",
    speed: "Speed",
    colorMode: "Color Mode",
    lightColor: "Light Color",
    bgColor: "Background Color"
  },
  ja: {
    title: "\u30B3\u30FC\u30B9\u30C6\u30A3\u30C3\u30AF",
    intensity: "\u5F37\u5EA6",
    scale: "\u30B9\u30B1\u30FC\u30EB",
    complexity: "\u8907\u96D1\u3055",
    speed: "\u901F\u5EA6",
    colorMode: "\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9",
    lightColor: "\u5149\u306E\u8272",
    bgColor: "\u80CC\u666F\u8272"
  }
});
var coastic = definePlugin({
  id: "caustics-effect-v1",
  title: t7("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 1
      },
      scale: {
        type: "real",
        default: 50
      },
      complexity: {
        type: "real",
        default: 3
      },
      speed: {
        type: "real",
        default: 0.5
      },
      colorMode: {
        type: "string",
        enum: ["blend", "add", "original"],
        default: "blend"
      },
      lightColor: {
        type: "color",
        default: { r: 1, g: 1, b: 1, a: 1 }
      },
      bgColor: {
        type: "color",
        default: { r: 0, g: 0.1, b: 0.2, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        lightColor: adjustColor(params.lightColor),
        bgColor: adjustColor(params.bgColor)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        scale: params.scale * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t22),
        scale: lerp(paramsA.scale, paramsB.scale, t22),
        complexity: lerp(paramsA.complexity, paramsB.complexity, t22),
        speed: lerp(paramsA.speed, paramsB.speed, t22),
        colorMode: t22 < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        lightColor: {
          r: lerp(paramsA.lightColor.r, paramsB.lightColor.r, t22),
          g: lerp(paramsA.lightColor.g, paramsB.lightColor.g, t22),
          b: lerp(paramsA.lightColor.b, paramsB.lightColor.b, t22),
          a: lerp(paramsA.lightColor.a, paramsB.lightColor.a, t22)
        },
        bgColor: {
          r: lerp(paramsA.bgColor.r, paramsB.bgColor.r, t22),
          g: lerp(paramsA.bgColor.g, paramsB.bgColor.g, t22),
          b: lerp(paramsA.bgColor.b, paramsB.bgColor.b, t22),
          a: lerp(paramsA.bgColor.a, paramsB.bgColor.a, t22)
        }
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "intensity", dataType: "float", min: 0, max: 2, value: params.intensity }),
            ui.numberInput({ key: "intensity", dataType: "float", value: params.intensity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "scale", dataType: "float", min: 10, max: 200, value: params.scale }),
            ui.numberInput({ key: "scale", dataType: "float", value: params.scale })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("complexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "complexity", dataType: "float", min: 1, max: 10, value: params.complexity }),
            ui.numberInput({ key: "complexity", dataType: "float", value: params.complexity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("speed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "speed", dataType: "float", min: 0, max: 2, value: params.speed }),
            ui.numberInput({ key: "speed", dataType: "float", value: params.speed })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            { label: "Blend", value: "blend" },
            { label: "Add", value: "add" },
            { label: "Original", value: "original" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("lightColor") }),
          ui.colorInput({ key: "lightColor", value: params.lightColor })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("bgColor") }),
          ui.colorInput({ key: "bgColor", value: params.bgColor })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Caustics Effect)" }
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              intensity: f32,
              scale: f32,
              complexity: f32,
              speed: f32,
              colorMode: u32,
              time: f32,
              lightColor: vec4f,
              bgColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Hash function for pseudo-random numbers
            fn hash(p: vec2f) -> f32 {
              let p2 = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
              return fract(sin(dot(p2, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            // Value noise function
            fn noise(p: vec2f) -> f32 {
              let i = floor(p);
              let f = fract(p);

              // Four corners interpolation
              let a = hash(i);
              let b = hash(i + vec2f(1.0, 0.0));
              let c = hash(i + vec2f(0.0, 1.0));
              let d = hash(i + vec2f(1.0, 1.0));

              // Smooth interpolation
              let u = f * f * (3.0 - 2.0 * f);

              return mix(
                  mix(a, b, u.x),
                  mix(c, d, u.x),
                  u.y
              );
            }

            // FBM (Fractal Brownian Motion) for more complex noise
            fn fbm(p: vec2f, octaves: f32) -> f32 {
              var value = 0.0;
              var amplitude = 0.5;
              var freq = 1.0;

              // Use loop with constant max iterations to avoid dynamic loops
              let maxOctaves = 10.0;

              for (var i = 0.0; i < maxOctaves; i += 1.0) {
                if (i >= octaves) {
                  break;
                }

                value += amplitude * noise(p * freq);
                freq *= 2.0;
                amplitude *= 0.5;
              }

              return value;
            }

            // Main caustics function
            fn caustics(p: vec2f, time: f32, scale: f32, complexity: f32) -> f32 {
              let uv = p * scale * 0.01;

              // Generate two noise patterns that move in different directions
              let noise1 = fbm(uv + vec2f(time * 0.2, time * 0.3), complexity);
              let noise2 = fbm(uv + vec2f(-time * 0.1, time * 0.2), complexity);

              // Generate interference pattern
              let pattern = sin((noise1 - noise2) * 6.28) * 0.5 + 0.5;

              // Add extra detail
              let detail = fbm(uv * 3.0 + vec2f(time * 0.1), complexity) * 0.3;

              return pow(pattern + detail, 1.8);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // Get original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Generate caustics pattern
              let p = vec2f(texCoord.x, texCoord.y) - 0.5;
              let intensity = caustics(p, params.time * params.speed, params.scale, params.complexity) * params.intensity;

              // Create caustics color using light color
              let causticsColor = params.lightColor * intensity;

              // Apply color mode
              var finalColor: vec4f = vec4f(0.0);

              // Mode: 0 = blend, 1 = add, 2 = original
              if (params.colorMode == 0u) {
                let blend = mix(params.bgColor, params.lightColor, intensity);
                finalColor = mix(originalColor, blend, params.bgColor.a * params.intensity);
              } else if (params.colorMode == 1u) {
                finalColor = originalColor + causticsColor * params.intensity;
              } else {
                finalColor = originalColor;
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
        `;
          const shader = device.createShaderModule({
            label: "Caustics Shader",
            code
          });
          const defs = makeShaderDataDefinitions7(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "Caustics Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, defs };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, { dpi, baseDpi }) => {
      console.log("Caustics Effect V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView7(defs.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        inputDpi: dpi,
        baseDpi,
        intensity: params.intensity,
        scale: params.scale,
        complexity: params.complexity,
        speed: params.speed,
        colorMode: params.colorMode === "blend" ? 0 : params.colorMode === "add" ? 1 : params.colorMode === "original" ? 2 : 0,
        time: performance.now() / 1e3,
        lightColor: [
          params.lightColor.r,
          params.lightColor.g,
          params.lightColor.b,
          params.lightColor.a
        ],
        bgColor: [
          params.bgColor.r,
          params.bgColor.g,
          params.bgColor.b,
          params.bgColor.a
        ]
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Caustics Effect Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/halftone.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions8,
  makeStructuredView as makeStructuredView8
} from "npm:webgpu-utils";
var t8 = createTranslator({
  en: {
    title: "Halftone Effect",
    dotSize: "Dot Size",
    dotAngle: "Dot Angle",
    dotColor: "Dot Color",
    placementPattern: "Dot Placement",
    gridPattern: "Grid",
    staggeredPattern: "Staggered",
    color: "Color"
  },
  ja: {
    title: "\u30CF\u30FC\u30D5\u30C8\u30FC\u30F3\u30A8\u30D5\u30A7\u30AF\u30C8",
    dotSize: "\u30C9\u30C3\u30C8\u30B5\u30A4\u30BA",
    dotAngle: "\u30C9\u30C3\u30C8\u306E\u89D2\u5EA6",
    dotColor: "\u30C9\u30C3\u30C8\u306E\u8272",
    placementPattern: "\u30C9\u30C3\u30C8\u914D\u7F6E",
    gridPattern: "\u30B0\u30EA\u30C3\u30C9",
    staggeredPattern: "\u4EA4\u5DEE",
    color: "\u8272"
  }
});
var halftone = definePlugin({
  id: "halftone-effect-v1",
  title: t8("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      size: {
        type: "real",
        default: 4
        // description: "Dot size in pixels",
      },
      angle: {
        type: "real",
        default: 0
        // description: "Dot array angle in degrees",
      },
      placementPattern: {
        type: "string",
        default: "grid",
        enum: ["grid", "staggered"],
        description: "Dot placement pattern"
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        color: adjustColor(params.color)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor,
        angle: params.angle,
        // Angle doesn't need scaling
        placementPattern: params.placementPattern
        // Pattern doesn't need scaling
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t22),
        angle: lerp(paramsA.angle, paramsB.angle, t22),
        placementPattern: t22 < 0.5 ? paramsA.placementPattern : paramsB.placementPattern,
        // Enum values don't interpolate
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t22),
          g: lerp(paramsA.color.g, paramsB.color.g, t22),
          b: lerp(paramsA.color.b, paramsB.color.b, t22),
          a: lerp(paramsA.color.a, paramsB.color.a, t22)
        }
      };
    },
    renderUI: (params, { setParam }) => {
      const colorStr = toColorCode(params.color);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("dotSize") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.5,
            max: 100,
            value: params.size
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("placementPattern") }),
          ui.select({
            key: "placementPattern",
            options: [
              { value: "grid", label: t8("gridPattern") }
              // { value: "staggered", label: t("staggeredPattern") },
            ],
            value: params.placementPattern || "grid"
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("dotAngle") }),
          ui.slider({
            key: "angle",
            dataType: "float",
            min: 0,
            max: 360,
            value: params.angle
          }),
          ui.numberInput({
            key: "angle",
            dataType: "float",
            value: params.angle
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("dotColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({
              key: "color",
              value: params.color
            }),
            ui.textInput({
              key: "colorInput",
              value: colorStr,
              onChange: (e) => {
                setParam({ color: parseColorCode(e.value) });
              }
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Halftone Effect)" }
        },
        (device) => {
          const code = `
struct Params {
  outputSize: vec2i,
  dpiScale: f32,
  size: f32,
  angle: f32,
  color: vec4f,
  placementPattern: i32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var textureSampler: sampler;
@group(0) @binding(3) var<uniform> params: Params;

fn rgbToGray(color: vec3f, alpha: f32) -> f32 {
  return dot(color.rgb, vec3f(0.299, 0.587, 0.114)) * alpha;
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  // Basic setup
  let outputSize = vec2f(params.outputSize);
  let currentPixel = vec2f(id.xy);

  // Skip padding pixels
  if (currentPixel.x >= outputSize.x || currentPixel.y >= outputSize.y) {
    return;
  }

  // Calculate rotation matrices
  let radians = params.angle * 3.14159265359 / 180.0;
  let cosTheta = cos(radians);
  let sinTheta = sin(radians);

  // Create rotation and inverse rotation matrices
  let rotMatrix = mat2x2(
    cosTheta, sinTheta,
    -sinTheta, cosTheta
  );

  let invRotMatrix = mat2x2(
    cosTheta, -sinTheta,
    sinTheta, cosTheta
  );

  // Center and rotate current pixel
  let center = outputSize * 0.5;
  let centered = currentPixel - center;
  let rotated = rotMatrix * centered;
  let rotatedPixel = rotated + center;

  // Calculate cell size in pixels (consistent scaling)
  let dotSizeScaled = params.size * params.dpiScale;
  let cellSize = vec2f(dotSizeScaled, dotSizeScaled);

  // Calculate cell coordinates
  let baseCell = rotatedPixel / cellSize;
  var cellX = floor(baseCell.x);
  let cellY = floor(baseCell.y);

  // Apply staggered pattern offset for odd rows if needed
  if (params.placementPattern == 1) {
    let isOddRow = (cellY % 2.0) == 1.0;
    if (isOddRow) {
      cellX = floor(baseCell.x + 0.5);
    }
  }

  // Calculate cell origin and position within cell
  let cellOrigin = vec2f(cellX, cellY) * cellSize;
  let posInCell = (rotatedPixel - cellOrigin) / cellSize;

  // Calculate cell center
  let cellCenter = cellOrigin + cellSize * 0.5;

  // Transform cell center back to original space for sampling
  let centeredCellCenter = cellCenter - center;
  let originalCellCenter = invRotMatrix * centeredCellCenter;
  let samplePoint = originalCellCenter + center;

  // Get padding-corrected coordinates
  let texCoord = samplePoint / outputSize;
  let paddedTextureSize = vec2f(textureDimensions(inputTexture));
  let paddingCorrection = outputSize / paddedTextureSize;
  let sampleCoord = texCoord * paddingCorrection;

  // Sample original image
  let origColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);
  let grayscale = rgbToGray(origColor.rgb, origColor.a);

  // Adjust brightness and calculate dot size
  let brightness = clamp(pow(grayscale, 0.7), 0.0, 0.95);
  let dotScale = 0.4;
  let dotRadius = (1.0 - brightness) * dotScale;
  let minDotRadius = 0.05;
  let finalDotRadius = max(dotRadius, minDotRadius);

  // Calculate distance from center of cell
  let distToCenter = length(posInCell - vec2f(0.5, 0.5));

  // Create circular dot with anti-aliased edge
  let edgeWidth = 0.01;
  let alpha = 1.0 - smoothstep(finalDotRadius - edgeWidth, finalDotRadius + edgeWidth, distToCenter);

  // Apply final color
  var finalAlpha = 0.02;
  if (alpha > 0.01) {
    finalAlpha = alpha * params.color.a;
  }

  textureStore(resultTexture, id.xy, vec4f(params.color.rgb, finalAlpha));
}
`;
          const shader = device.createShaderModule({
            label: "Halftone Effect Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions8(code);
          const pipeline = device.createComputePipeline({
            label: "Halftone Effect Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Halftone Effect", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Halftone Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Halftone Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Halftone Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView8(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Halftone Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        size: params.size,
        angle: params.angle,
        placementPattern: params.placementPattern === "staggered" ? 1 : 0,
        color: [params.color.r, params.color.g, params.color.b, params.color.a]
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Halftone Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Halftone Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Halftone Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/fluid-distortion.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions9,
  makeStructuredView as makeStructuredView9
} from "npm:webgpu-utils";
var t9 = createTranslator({
  en: {
    title: "Fluid Distortion V1",
    intensity: "Intensity",
    speed: "Speed",
    scale: "Scale",
    turbulence: "Turbulence",
    colorShift: "Color Shift",
    timeSeed: "Flow Seed",
    padding: "Padding"
  },
  ja: {
    title: "\u30D5\u30EB\u30A4\u30C9 \u30C7\u30A3\u30B9\u30C8\u30FC\u30B7\u30E7\u30F3 V1",
    intensity: "\u5F37\u5EA6",
    speed: "\u901F\u5EA6",
    scale: "\u30B9\u30B1\u30FC\u30EB",
    turbulence: "\u4E71\u6D41",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    timeSeed: "\u30D5\u30ED\u30FC\u30B7\u30FC\u30C9",
    padding: "\u30D1\u30C7\u30A3\u30F3\u30B0"
  }
});
var fluidDistortion = definePlugin({
  id: "fluid-distortion-v1",
  title: t9("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 20
      },
      speed: {
        type: "real",
        default: 0.5
      },
      scale: {
        type: "real",
        default: 3
      },
      turbulence: {
        type: "real",
        default: 0.3
      },
      colorShift: {
        type: "real",
        default: 0.1
      },
      padding: {
        type: "int",
        default: 0
      },
      timeSeed: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        intensity: Math.max(0, params.intensity),
        speed: Math.max(0, params.speed),
        scale: Math.max(0.1, params.scale),
        turbulence: Math.max(0, params.turbulence),
        colorShift: Math.max(0, params.colorShift),
        timeSeed: params.timeSeed % 1e3
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        intensity: params.intensity * scaleFactor,
        scale: params.scale * scaleFactor,
        colorShift: params.colorShift
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t22),
        speed: lerp(paramsA.speed, paramsB.speed, t22),
        scale: lerp(paramsA.scale, paramsB.scale, t22),
        turbulence: lerp(paramsA.turbulence, paramsB.turbulence, t22),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t22),
        timeSeed: lerp(paramsA.timeSeed, paramsB.timeSeed, t22)
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "intensity",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.intensity
            }),
            ui.numberInput({
              key: "intensity",
              dataType: "float",
              value: params.intensity
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("speed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "speed",
              dataType: "float",
              min: 0,
              max: 5,
              value: params.speed
            }),
            ui.numberInput({
              key: "speed",
              dataType: "float",
              value: params.speed
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "scale",
              dataType: "float",
              min: 0.1,
              max: 20,
              value: params.scale
            }),
            ui.numberInput({
              key: "scale",
              dataType: "float",
              value: params.scale
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("turbulence") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "turbulence",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.turbulence
            }),
            ui.numberInput({
              key: "turbulence",
              dataType: "float",
              value: params.turbulence
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "colorShift",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.colorShift
            }),
            ui.numberInput({
              key: "colorShift",
              dataType: "float",
              value: params.colorShift
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("timeSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "timeSeed",
              dataType: "float",
              min: 0,
              max: 1e3,
              value: params.timeSeed
            }),
            ui.numberInput({
              key: "timeSeed",
              dataType: "float",
              value: params.timeSeed
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t9("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "padding",
              dataType: "int",
              min: 0,
              max: 600,
              value: params.padding
            }),
            ui.numberInput({
              key: "padding",
              dataType: "int",
              value: params.padding
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Fluid Distortion)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              intensity: f32,
              speed: f32,
              scale: f32,
              turbulence: f32,
              colorShift: f32,
              timeSeed: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Simplex noise functions based on https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
            fn permute4(x: vec4f) -> vec4f {
              return ((x * 34.0) + 1.0) * x % 289.0;
            }

            fn taylorInvSqrt4(r: vec4f) -> vec4f {
              return 1.79284291400159 - 0.85373472095314 * r;
            }

            fn noise3D(v: vec3f) -> f32 {
              let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
              let D = vec4f(0.0, 0.5, 1.0, 2.0);

              // First corner
              var i = floor(v + dot(v, C.yyy));
              let x0 = v - i + dot(i, C.xxx);

              // Other corners
              let g = step(x0.yzx, x0.xyz);
              let l = 1.0 - g;
              let i1 = min(g.xyz, l.zxy);
              let i2 = max(g.xyz, l.zxy);

              // x0 = x0 - 0.0 + 0.0 * C.xxx;
              let x1 = x0 - i1 + 1.0 * C.xxx;
              let x2 = x0 - i2 + 2.0 * C.xxx;
              let x3 = x0 - 1.0 + 3.0 * C.xxx;

              // Permutations
              i = i % 289.0;
              let p = permute4(permute4(permute4(
                      i.z + vec4f(0.0, i1.z, i2.z, 1.0)) +
                      i.y + vec4f(0.0, i1.y, i2.y, 1.0)) +
                      i.x + vec4f(0.0, i1.x, i2.x, 1.0));

              // Gradients
              let n_ = 1.0 / 7.0; // N=7
              let ns = n_ * D.wyz - D.xzx;

              let j = p - 49.0 * floor(p * ns.z * ns.z);

              let x_ = floor(j * ns.z);
              let y_ = floor(j - 7.0 * x_);

              let x = x_ * ns.x + ns.yyyy;
              let y = y_ * ns.x + ns.yyyy;
              let h = 1.0 - abs(x) - abs(y);

              let b0 = vec4f(x.xy, y.xy);
              let b1 = vec4f(x.zw, y.zw);

              let s0 = floor(b0) * 2.0 + 1.0;
              let s1 = floor(b1) * 2.0 + 1.0;
              let sh = -step(h, vec4f(0.0));

              let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
              let a1 = b1.xzyw + s1.xzyw * sh.zzww;

              var p0 = vec3f(a0.xy, h.x);
              var p1 = vec3f(a0.zw, h.y);
              var p2 = vec3f(a1.xy, h.z);
              var p3 = vec3f(a1.zw, h.w);

              // Normalise gradients
              let norm = taylorInvSqrt4(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
              p0 = p0 * norm.x;
              p1 = p1 * norm.y;
              p2 = p2 * norm.z;
              p3 = p3 * norm.w;

              // Mix final noise value
              var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
              m = m * m;
              return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }

            // Function to create fluid-like distortion
            fn fluidDistortion(uv: vec2f, time: f32, scale: f32, turbulence: f32) -> vec2f {
              let t = time * 0.1;

              // Create different frequency noise patterns
              // Base layer - smooth flow
              let baseNoiseX = noise3D(vec3f(uv.x * scale, uv.y * scale, t));
              let baseNoiseY = noise3D(vec3f(uv.x * scale * 1.2, uv.y * scale * 1.2, t * 1.3));

              // Turbulent layer - higher frequency and more chaotic
              let turbNoiseX = noise3D(vec3f(uv.y * scale * 2.5, uv.x * scale * 2.5, t * 1.7));
              let turbNoiseY = noise3D(vec3f(uv.y * scale * 3.0, uv.x * scale * 2.0, t * 1.9));

              // Additional chaotic pattern for extreme turbulence
              let chaosNoiseX = noise3D(vec3f(uv.y * scale * 4.0 + baseNoiseX, uv.x * scale * 3.5, t * 2.3));
              let chaosNoiseY = noise3D(vec3f(uv.x * scale * 4.5 + baseNoiseY, uv.y * scale * 4.0, t * 2.1));

              // Apply non-linear turbulence mixing for more dramatic effect
              let turb = turbulence * turbulence; // Non-linear scaling for stronger effect

              // First interpolate between base and turbulent noise
              let mixedNoiseX = mix(baseNoiseX, turbNoiseX, min(turb, 1.0));
              let mixedNoiseY = mix(baseNoiseY, turbNoiseY, min(turb, 1.0));

              // For high turbulence (>1.0), blend in chaotic patterns using select function
              let extremeFactor = max(0.0, turbulence - 1.0);
              let hasExtremeTurbulence = turbulence > 1.0;

              // Use the select function to conditionally mix in chaotic noise
              let finalNoiseX = select(
                mixedNoiseX,
                mix(mixedNoiseX, chaosNoiseX, extremeFactor),
                hasExtremeTurbulence
              );

              let finalNoiseY = select(
                mixedNoiseY,
                mix(mixedNoiseY, chaosNoiseY, extremeFactor),
                hasExtremeTurbulence
              );

              return vec2f(finalNoiseX, finalNoiseY);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / dimsWithGPUPadding;
                let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                // Apply fluid distortion with DPI-aware scaling
                let distortionVec = fluidDistortion(
                    texCoord,
                    params.timeSeed * params.speed,
                    params.scale,
                    params.turbulence
                );

                // Adjust distortion amount based on turbulence
                let turbulenceBoost = 1.0 + (params.turbulence * 0.5);
                let distortionAmount = (params.intensity / 1000.0) * turbulenceBoost;
                let distortedCoord = texCoord + distortionVec * distortionAmount;

                // Apply chromatic aberration
                let chromaticShift = params.colorShift * 0.01 * (1.0 + params.turbulence * 0.3);
                let redOffset = distortedCoord + distortionVec * chromaticShift;
                let blueOffset = distortedCoord - distortionVec * chromaticShift;

                // Sample the texture with the distorted coordinates
                let colorR = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0).r;
                let colorG = textureSampleLevel(inputTexture, textureSampler, distortedCoord * toInputTexCoord, 0.0).g;
                let colorB = textureSampleLevel(inputTexture, textureSampler, blueOffset * toInputTexCoord, 0.0).b;
                let colorA = textureSampleLevel(inputTexture, textureSampler, distortedCoord * toInputTexCoord, 0.0).a;

                let finalColor = vec4f(colorR, colorG, colorB, colorA);
                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Fluid Distortion Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions9(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "Fluid Distortion Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Fluid Distortion V1", params);
      const dpiScale = dpi / baseDpi;
      const intensityFactor = params.intensity / 10;
      const scaleFactor = 5 / Math.max(0.5, params.scale);
      const turbulenceFactor = params.turbulence * 1.5;
      const colorShiftFactor = params.colorShift * 2;
      const paddingSize = Math.ceil(
        (params.padding + (intensityFactor * scaleFactor * (1 + turbulenceFactor) + colorShiftFactor * params.intensity / 20)) * dpiScale
      );
      const minimumPadding = Math.ceil(5 * dpiScale);
      const finalPaddingSize = Math.max(minimumPadding, paddingSize);
      console.log(
        "Calculated padding size:",
        finalPaddingSize,
        "DPI:",
        dpi,
        "baseDPI:",
        baseDpi
      );
      imgData = await paddingImageData(imgData, finalPaddingSize);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "repeat",
        addressModeV: "repeat"
      });
      const uniformValues = makeStructuredView9(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        intensity: params.intensity,
        speed: params.speed,
        scale: params.scale,
        turbulence: params.turbulence,
        colorShift: params.colorShift,
        timeSeed: params.timeSeed
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      console.time("writeTexture");
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      console.timeEnd("writeTexture");
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Fluid Distortion Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      console.time("execute");
      device.queue.submit([commandEncoder.finish()]);
      console.timeEnd("execute");
      console.time("mapAsync");
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      console.timeEnd("mapAsync");
      console.time("getMappedRange");
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      console.timeEnd("getMappedRange");
      console.time("ImageData");
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      console.timeEnd("ImageData");
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/kaleidoscope.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions10,
  makeStructuredView as makeStructuredView10
} from "npm:webgpu-utils";
var t10 = createTranslator({
  en: {
    title: "[WIP] Kaleidoscope",
    segments: "Segments",
    pattern: "Pattern",
    rotation: "Rotation",
    centerX: "Sample Position X",
    centerY: "Sample Position Y",
    zoom: "Zoom",
    distortion: "Distortion",
    complexity: "Complexity",
    colorShift: "Color Shift",
    cellEffect: "Cell Reflection",
    cellSize: "Cell Size",
    blendMode: "Blend Mode",
    padding: "Padding",
    triangular: "Triangular",
    square: "Square",
    hexagonal: "Hexagonal",
    octagonal: "Octagonal",
    circular: "Circular",
    spiral: "Spiral",
    fractal: "Fractal",
    composite: "Composite",
    normal: "Normal",
    kaleidoscope: "Kaleidoscope",
    mirror: "Mirror",
    rotational: "Rotational"
  },
  ja: {
    title: "[WIP] \u4E07\u83EF\u93E1",
    segments: "\u5206\u5272\u6570",
    pattern: "\u30D1\u30BF\u30FC\u30F3",
    rotation: "\u56DE\u8EE2",
    centerX: "\u30B5\u30F3\u30D7\u30EB\u4F4D\u7F6E X",
    centerY: "\u30B5\u30F3\u30D7\u30EB\u4F4D\u7F6E Y",
    zoom: "\u30BA\u30FC\u30E0",
    distortion: "\u6B6A\u307F",
    complexity: "\u8907\u96D1\u3055",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    cellEffect: "\u30BB\u30EB\u53CD\u5C04",
    cellSize: "\u30BB\u30EB\u30B5\u30A4\u30BA",
    blendMode: "\u30D6\u30EC\u30F3\u30C9\u30E2\u30FC\u30C9",
    padding: "\u30D1\u30C7\u30A3\u30F3\u30B0",
    triangular: "\u4E09\u89D2\u5F62",
    square: "\u56DB\u89D2\u5F62",
    hexagonal: "\u516D\u89D2\u5F62",
    octagonal: "\u516B\u89D2\u5F62",
    circular: "\u5186\u5F62",
    spiral: "\u6E26\u5DFB\u304D",
    fractal: "\u30D5\u30E9\u30AF\u30BF\u30EB",
    composite: "\u8907\u5408",
    normal: "\u30CE\u30FC\u30DE\u30EB",
    kaleidoscope: "\u4E07\u83EF\u93E1",
    mirror: "\u30DF\u30E9\u30FC",
    rotational: "\u56DE\u8EE2"
  }
});
var kaleidoscope = definePlugin({
  id: "kaleidoscope",
  title: t10("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      pattern: {
        type: "string",
        enum: [
          "triangular",
          "square",
          "hexagonal",
          "octagonal",
          "circular",
          "spiral",
          "fractal",
          "composite"
        ],
        default: "triangular"
      },
      segments: {
        type: "int",
        default: 6,
        min: 2,
        max: 36
      },
      rotation: {
        type: "real",
        default: 0,
        min: 0,
        max: 360
      },
      centerX: {
        type: "real",
        default: 0.5,
        min: -1,
        max: 2
      },
      centerY: {
        type: "real",
        default: 0.5,
        min: -1,
        max: 2
      },
      zoom: {
        type: "real",
        default: 1,
        min: 0.1,
        max: 5
      },
      distortion: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      complexity: {
        type: "real",
        default: 0.5,
        min: 0,
        max: 1
      },
      colorShift: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      cellEffect: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      cellSize: {
        type: "real",
        default: 0.2,
        min: 0.05,
        max: 1
      },
      blendMode: {
        type: "string",
        enum: ["normal", "kaleidoscope", "mirror", "rotational"],
        default: "normal"
      },
      padding: {
        type: "int",
        default: 0,
        min: 0,
        max: 500
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        segments: Math.max(2, Math.min(36, Math.round(params.segments))),
        rotation: (params.rotation % 360 + 360) % 360,
        centerX: Math.max(-1, Math.min(2, params.centerX)),
        centerY: Math.max(-1, Math.min(2, params.centerY)),
        zoom: Math.max(0.1, Math.min(5, params.zoom)),
        distortion: Math.max(0, Math.min(1, params.distortion)),
        complexity: Math.max(0, Math.min(1, params.complexity)),
        colorShift: Math.max(0, Math.min(1, params.colorShift)),
        cellEffect: Math.max(0, Math.min(1, params.cellEffect)),
        cellSize: Math.max(0.05, Math.min(1, params.cellSize)),
        padding: Math.max(0, Math.min(500, Math.round(params.padding)))
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params
        // Ex.
        // color: adjustColor(params.color),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        padding: Math.round(params.padding * scaleFactor)
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        pattern: t22 < 0.5 ? paramsA.pattern : paramsB.pattern,
        segments: Math.round(lerp(paramsA.segments, paramsB.segments, t22)),
        rotation: lerp(paramsA.rotation, paramsB.rotation, t22),
        centerX: lerp(paramsA.centerX, paramsB.centerX, t22),
        centerY: lerp(paramsA.centerY, paramsB.centerY, t22),
        zoom: lerp(paramsA.zoom, paramsB.zoom, t22),
        distortion: lerp(paramsA.distortion, paramsB.distortion, t22),
        complexity: lerp(paramsA.complexity, paramsB.complexity, t22),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t22),
        cellEffect: lerp(paramsA.cellEffect, paramsB.cellEffect, t22),
        cellSize: lerp(paramsA.cellSize, paramsB.cellSize, t22),
        blendMode: t22 < 0.5 ? paramsA.blendMode : paramsB.blendMode,
        padding: Math.round(lerp(paramsA.padding, paramsB.padding, t22))
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("pattern") }),
          ui.select({ key: "pattern", value: params.pattern, options: [
            { label: t10("triangular"), value: "triangular" },
            { label: t10("square"), value: "square" },
            { label: t10("hexagonal"), value: "hexagonal" },
            { label: t10("octagonal"), value: "octagonal" },
            { label: t10("circular"), value: "circular" },
            { label: t10("spiral"), value: "spiral" },
            { label: t10("fractal"), value: "fractal" },
            { label: t10("composite"), value: "composite" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("blendMode") }),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            { label: t10("normal"), value: "normal" },
            { label: t10("kaleidoscope"), value: "kaleidoscope" },
            { label: t10("mirror"), value: "mirror" },
            { label: t10("rotational"), value: "rotational" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("segments") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "segments", dataType: "int", min: 2, max: 36, value: params.segments }),
            ui.numberInput({ key: "segments", dataType: "int", value: params.segments })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("rotation") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "rotation", dataType: "float", min: 0, max: 360, value: params.rotation }),
            ui.numberInput({ key: "rotation", dataType: "float", value: params.rotation })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("centerX") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerX", dataType: "float", min: -1, max: 2, value: params.centerX }),
            ui.numberInput({ key: "centerX", dataType: "float", value: params.centerX })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("centerY") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerY", dataType: "float", min: -1, max: 2, value: params.centerY }),
            ui.numberInput({ key: "centerY", dataType: "float", value: params.centerY })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("zoom") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "zoom", dataType: "float", min: 0.1, max: 5, value: params.zoom }),
            ui.numberInput({ key: "zoom", dataType: "float", value: params.zoom })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("distortion") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "distortion", dataType: "float", min: 0, max: 1, value: params.distortion }),
            ui.numberInput({ key: "distortion", dataType: "float", value: params.distortion })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("complexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "complexity", dataType: "float", min: 0, max: 1, value: params.complexity }),
            ui.numberInput({ key: "complexity", dataType: "float", value: params.complexity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 1, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: "float", value: params.colorShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t10("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "padding", dataType: "int", min: 0, max: 500, value: params.padding }),
            ui.numberInput({ key: "padding", dataType: "int", value: params.padding })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Kaleidoscope)" }
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              segments: i32,
              patternType: i32, // 0: triangular, 1: square, 2: hexagonal, 3: octagonal, 4: circular, 5: spiral, 6: fractal, 7: composite
              rotation: f32,    // in degrees
              centerX: f32,     // normalized 0-1 (sampling position)
              centerY: f32,     // normalized 0-1 (sampling position)
              zoom: f32,        // scale factor
              distortion: f32,  // 0-1
              complexity: f32,  // 0-1
              colorShift: f32,  // 0-1
              cellEffect: f32,  // 0-1
              cellSize: f32,    // cell size for reflection effect
              blendMode: i32    // 0: normal, 1: kaleidoscope, 2: mirror, 3: rotational
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Convert degrees to radians
            fn degToRad(degrees: f32) -> f32 {
              return degrees * 3.14159265359 / 180.0;
            }

            // Rotate a 2D point around a center
            fn rotate2D(point: vec2f, center: vec2f, angle: f32) -> vec2f {
              let s = sin(angle);
              let c = cos(angle);
              let p = point - center;
              return vec2f(
                p.x * c - p.y * s,
                p.x * s + p.y * c
              ) + center;
            }

            // Hash function to generate pseudo-random numbers
            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            // Hash function for 2D coordinates
            fn hash2D(p: vec2f) -> f32 {
              return hash(p.x + p.y * 57.0);
            }

            // Random 2D vector
            fn random2D(p: vec2f) -> vec2f {
              return vec2f(
                hash(p.x * 127.1 + p.y * 311.7),
                hash(p.x * 269.5 + p.y * 183.3)
              ) * 2.0 - 1.0;
            }

            // Voronoi/cellular noise for cell-based reflection
            fn voronoi(uv: vec2f, cellSize: f32) -> vec2f {
              let scaledUV = uv / cellSize;
              let cellUV = floor(scaledUV);
              let fractUV = vec2f(fract(scaledUV.x), fract(scaledUV.y));

              var minDist = 8.0;
              var cellPoint = vec2f(0.0, 0.0);
              var cellCenter = vec2f(0.0, 0.0);

              // Check surrounding cells (3x3 grid)
              for (var y = -1.0; y <= 1.0; y += 1.0) {
                for (var x = -1.0; x <= 1.0; x += 1.0) {
                  let cell = cellUV + vec2f(x, y);

                  // Get random point within this cell
                  let cellRandom = random2D(cell);
                  let pointPos = vec2f(x, y) + 0.5 + 0.5 * cellRandom;

                  // Calculate distance to this point
                  let diff = pointPos - fractUV;
                  let dist = length(diff);

                  if (dist < minDist) {
                    minDist = dist;
                    cellPoint = cell + pointPos;
                    cellCenter = cell + vec2f(0.5, 0.5);
                  }
                }
              }

              return vec2f(minDist, distance(cellPoint, cellCenter));
            }

            // Apply cell reflection/refraction effect
            fn applyCellEffect(coord: vec2f, center: vec2f, cellEffect: f32, cellSize: f32) -> vec2f {
              if (cellEffect <= 0.0) {
                return coord;
              }

              let voronoiResult = voronoi(coord, cellSize);
              let cellDistance = voronoiResult.x;
              let centerDistance = voronoiResult.y;

              // Create a refraction-like effect at cell boundaries
              let distortionStrength = smoothstep(0.0, 0.4, cellDistance) * (1.0 - smoothstep(0.4, 0.5, cellDistance));
              let distortionDirection = normalize(coord - center) * (centerDistance * 0.5 + 0.5);

              // Apply the distortion
              return coord + distortionDirection * distortionStrength * cellEffect * 0.1;
            }

            // Generic distortion function
            fn applyDistortion(coord: vec2f, center: vec2f, distortionAmount: f32) -> vec2f {
              if (distortionAmount <= 0.0) {
                return coord;
              }

              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x);

              // Apply wave distortion
              let wave = sin(distance * 10.0 * distortionAmount) * distortionAmount * 0.1;
              let distortedDistance = distance * (1.0 + wave);

              // Apply twirl distortion
              let twirl = distortionAmount * 5.0 * (1.0 - smoothstep(0.0, 0.5, distance));
              let distortedAngle = angle + twirl;

              return vec2f(
                center.x + cos(distortedAngle) * distortedDistance,
                center.y + sin(distortedAngle) * distortedDistance
              );
            }

            // Spiral transform
            fn spiralTransform(coord: vec2f, center: vec2f, complexity: f32, rotation: f32) -> vec2f {
              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x) + rotation;

              // Apply logarithmic spiral transformation
              let spiralFactor = 0.1 + complexity * 0.4;
              let spiralAngle = angle + distance * spiralFactor * 10.0;

              return vec2f(
                center.x + cos(spiralAngle) * distance,
                center.y + sin(spiralAngle) * distance
              );
            }

            // Fractal transform using simplified Julia set approach
            fn fractalTransform(coord: vec2f, center: vec2f, complexity: f32, iterations: i32) -> vec2f {
              let z = (coord - center) * 2.0; // Scale to make patterns more visible
              let c = vec2f(
                -0.8 + complexity * 0.6,
                0.156
              );

              var result = z;
              for (var i = 0; i < iterations; i++) {
                if (length(result) > 2.0) {
                  break;
                }

                // z = z^2 + c (complex number math)
                result = vec2f(
                  result.x * result.x - result.y * result.y,
                  2.0 * result.x * result.y
                ) + c;
              }

              return center + result * 0.25; // Scale back down
            }

            // Apply triangular kaleidoscope pattern
            fn triangularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle
              let segmentAngle = 2.0 * 3.14159265359 / f32(segments);
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror alternate segments
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply square kaleidoscope pattern
            fn squarePattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Mirror across both axes
              let mirroredOffset = vec2f(abs(offset.x), abs(offset.y));

              return mirroredOffset + center;
            }

            // Apply hexagonal kaleidoscope pattern
            fn hexagonalPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              // Hexagonal is a variant of triangular with some adjustments
              let segmentCount = segments * 2; // Double segments for hexagonal effect
              return triangularPattern(uv, center, segmentCount, rotation);
            }

            // Apply octagonal kaleidoscope pattern
            fn octagonalPattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle into 8 parts
              let segmentAngle = 2.0 * 3.14159265359 / 8.0;
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror every second segment
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply circular kaleidoscope pattern
            fn circularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the radial distance
              let segmentWidth = 0.1; // Adjust based on desired effect
              let segmentIndex = floor(distance / segmentWidth);
              let isEven = segmentIndex % 2.0;

              // Mirror every second circular ring
              let finalDistance = select(distance,
                segmentWidth * (segmentIndex + 1.0) - (distance - segmentWidth * segmentIndex),
                isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(angle) * finalDistance,
                sin(angle) * finalDistance
              );

              return finalOffset + center;
            }

            // Composite pattern that combines multiple patterns
            fn compositePattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32, complexity: f32) -> vec2f {
              // First apply triangular pattern
              let pattern1 = triangularPattern(uv, center, segments, rotation);

              // Then apply circular pattern with slight modification
              let pattern2 = circularPattern(pattern1, center, segments, rotation + 0.3);

              // Mix based on complexity
              let mix = smoothstep(0.3, 0.7, complexity);
              return mix * pattern2 + (1.0 - mix) * pattern1;
            }

            // Blend two coordinates based on blend mode
            fn blendCoordinates(coord1: vec2f, coord2: vec2f, blendMode: i32, factor: f32) -> vec2f {
              if (blendMode == 0) { // Normal
                return coord1;
              } else if (blendMode == 1) { // Kaleidoscope
                return mix(coord1, coord2, factor);
              } else if (blendMode == 2) { // Mirror
                let dist1 = length(coord1);
                let dist2 = length(coord2);
                return select(coord1, coord2, dist1 > dist2);
              } else { // Rotational
                let angle = factor * 6.28318;
                let c = cos(angle);
                let s = sin(angle);
                return c * coord1 + s * coord2;
              }
            }

            // Helper function for float fraction part
            fn fract(x: f32) -> f32 {
              return x - floor(x);
            }

            // Apply HSV color shift
            fn shiftColor(color: vec4f, shift: f32) -> vec4f {
              if (shift <= 0.0) {
                return color;
              }

              // Simple HSV shift (hue rotation)
              // Convert RGB to HSV-like space
              let maxC = max(max(color.r, color.g), color.b);
              let minC = min(min(color.r, color.g), color.b);
              let delta = maxC - minC;

              var h: f32 = 0.0;
              if (delta > 0.0) {
                if (maxC == color.r) {
                  h = 6.0 + (color.g - color.b) / delta;
                } else if (maxC == color.g) {
                  h = 2.0 + (color.b - color.r) / delta;
                } else {
                  h = 4.0 + (color.r - color.g) / delta;
                }
                h = h % 6.0;
              }

              // Apply hue shift
              h = (h + shift * 6.0) % 6.0;

              // Convert back to RGB
              let sector = floor(h);
              let f = h - sector;

              let p = minC;
              let q = minC + (maxC - minC) * (1.0 - f);
              let t = minC + (maxC - minC) * f;

              var newColor: vec3f;

              if (sector == 0.0) {
                newColor = vec3f(maxC, t, p);
              } else if (sector == 1.0) {
                newColor = vec3f(q, maxC, p);
              } else if (sector == 2.0) {
                newColor = vec3f(p, maxC, t);
              } else if (sector == 3.0) {
                newColor = vec3f(p, q, maxC);
              } else if (sector == 4.0) {
                newColor = vec3f(t, p, maxC);
              } else {
                newColor = vec3f(maxC, p, q);
              }

              return vec4f(newColor, color.a);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));
                let texCoord = vec2f(id.xy) / dims;

                // Fixed kaleidoscope center at image center
                let kaleidoscopeCenter = vec2f(0.5, 0.5);

                // Sample position based on centerX/Y parameters
                let samplePosition = vec2f(params.centerX, params.centerY);

                // Calculate texture coordinate offset from sample position
                let sampleOffset = kaleidoscopeCenter - samplePosition;

                // Apply zoom and offset to the texture coordinates
                let offsetCoord = (texCoord - kaleidoscopeCenter) / params.zoom + sampleOffset + kaleidoscopeCenter;

                // Apply cellular effect (refraction through cells)
                let cellCoord = applyCellEffect(offsetCoord, kaleidoscopeCenter, params.cellEffect, params.cellSize);

                // Apply distortion if enabled
                let distortedCoord = applyDistortion(cellCoord, kaleidoscopeCenter, params.distortion);

                // Apply appropriate kaleidoscope pattern based on the selected type
                var finalCoord1: vec2f;
                var finalCoord2: vec2f;

                // Generate two different coordinates for blending
                if (params.patternType == 0) {
                    // Triangular
                    finalCoord1 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments * 2, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 1) {
                    // Square
                    finalCoord1 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 45.0));
                } else if (params.patternType == 2) {
                    // Hexagonal
                    finalCoord1 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments + 2, degToRad(params.rotation + 15.0));
                } else if (params.patternType == 3) {
                    // Octagonal
                    finalCoord1 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 22.5));
                } else if (params.patternType == 4) {
                    // Circular
                    finalCoord1 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation));
                } else if (params.patternType == 5) {
                    // Spiral
                    finalCoord1 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity, degToRad(params.rotation));
                    finalCoord2 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 0.7, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 6) {
                    // Fractal
                    let iterations = 2 + i32(params.complexity * 8.0);
                    finalCoord1 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity, iterations);
                    finalCoord2 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 1.1, iterations - 1);
                } else {
                    // Composite
                    finalCoord1 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation), params.complexity);
                    finalCoord2 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation + 10.0), params.complexity * 0.8);
                }

                // Blend the two coordinates based on blend mode
                let blendedCoord = blendCoordinates(finalCoord1, finalCoord2, params.blendMode, params.complexity);

                // Loop coordinates to create seamless tiling effect
                let loopedCoord = vec2f(
                    blendedCoord.x - floor(blendedCoord.x),
                    blendedCoord.y - floor(blendedCoord.y)
                );

                // Apply one final cell effect for refraction at seams
                let finalCellCoord = applyCellEffect(loopedCoord, kaleidoscopeCenter, params.cellEffect * 0.5, params.cellSize * 0.5);

                // Sample the original texture at the transformed coordinates
                let sampledColor = textureSampleLevel(inputTexture, textureSampler, finalCellCoord, 0.0);

                // Apply color shifting if enabled
                let finalColor = shiftColor(sampledColor, params.colorShift);

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Kaleidoscope Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions10(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "Kaleidoscope Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({
      /* RMIT: return value from initLiveEffect -> */
      device,
      pipeline,
      pipelineDef
    }, params, imgData, { dpi, baseDpi }) => {
      console.log("Kaleidoscope Effect", params);
      imgData = await paddingImageData(imgData, params.padding);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView10(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const patternTypeMap = {
        triangular: 0,
        square: 1,
        hexagonal: 2,
        octagonal: 3,
        circular: 4,
        spiral: 5,
        fractal: 6,
        composite: 7
      };
      const blendModeMap = {
        normal: 0,
        kaleidoscope: 1,
        mirror: 2,
        rotational: 3
      };
      uniformValues.set({
        inputDpi: dpi,
        baseDpi,
        segments: params.segments,
        patternType: patternTypeMap[params.pattern] || 0,
        rotation: params.rotation,
        centerX: params.centerX,
        centerY: params.centerY,
        zoom: params.zoom,
        distortion: params.distortion,
        complexity: params.complexity,
        colorShift: params.colorShift,
        cellEffect: params.cellEffect,
        cellSize: params.cellSize,
        blendMode: blendModeMap[params.blendMode] || 0
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Kaleidoscope Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/vhs-interlace.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions11,
  makeStructuredView as makeStructuredView11
} from "npm:webgpu-utils";
var t11 = createTranslator({
  en: {
    title: "VHS & Interlace Effect",
    intensity: "Effect Intensity",
    noise: "Noise Amount",
    noiseDistortion: "Noise Distortion",
    colorShift: "Color Shift",
    scanlines: "Scanlines",
    interlaceGap: "Interlace Gap",
    brightnessJitter: "Brightness Jitter",
    trackingError: "Tracking Error",
    verticalJitter: "Vertical Distortion",
    tilt: "Line Tilt",
    vhsColor: "VHS Color Tone",
    enableVHSColor: "Enable VHS Color",
    randomSeed: "Random Seed",
    applyToTransparent: "Apply to Transparent Areas"
  },
  ja: {
    title: "VHS & \u30A4\u30F3\u30BF\u30FC\u30EC\u30FC\u30B9\u52B9\u679C",
    intensity: "\u52B9\u679C\u306E\u5F37\u5EA6",
    noise: "\u30CE\u30A4\u30BA\u91CF",
    noiseDistortion: "\u30CE\u30A4\u30BA\u6B6A\u307F",
    colorShift: "\u8272\u305A\u308C",
    scanlines: "\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3",
    interlaceGap: "\u30A4\u30F3\u30BF\u30FC\u30EC\u30FC\u30B9\u9593\u9694",
    brightnessJitter: "\u660E\u308B\u3055\u306E\u3086\u3089\u304E",
    trackingError: "\u30C8\u30E9\u30C3\u30AD\u30F3\u30B0\u30A8\u30E9\u30FC",
    verticalJitter: "\u7E26\u65B9\u5411\u306E\u6B6A\u307F",
    tilt: "\u7DDA\u306E\u50BE\u659C",
    vhsColor: "VHS\u8272\u8ABF",
    enableVHSColor: "VHS\u8272\u8ABF\u3092\u6709\u52B9\u5316",
    randomSeed: "\u30E9\u30F3\u30C0\u30E0\u30B7\u30FC\u30C9",
    applyToTransparent: "\u900F\u660E\u90E8\u5206\u306B\u3082\u9069\u7528"
  }
});
var MAX_VERTICAL_JITTER_PIXELS = 100;
var vhsInterlace = definePlugin({
  id: "vhs-interlace-effect-v1",
  title: t11("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 1
      },
      noise: {
        type: "real",
        default: 0.2
      },
      noiseDistortion: {
        type: "real",
        default: 0
      },
      colorShift: {
        type: "real",
        default: 2
      },
      scanlines: {
        type: "real",
        default: 0.5
      },
      interlaceGap: {
        type: "int",
        default: 2
      },
      brightnessJitter: {
        type: "real",
        default: 0.1
      },
      trackingError: {
        type: "real",
        default: 0.5
      },
      verticalJitter: {
        type: "real",
        default: 0.05
      },
      tilt: {
        type: "real",
        default: 0
      },
      randomSeed: {
        type: "real",
        default: 0.5
      },
      enableVHSColor: {
        type: "bool",
        default: true
      },
      vhsColor: {
        type: "color",
        default: {
          r: 0.9,
          g: 0.7,
          b: 0.8,
          a: 0.3
        }
      },
      applyToTransparent: {
        type: "bool",
        default: true
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        intensity: Math.max(0, Math.min(2, params.intensity)),
        noise: Math.max(0, Math.min(1, params.noise)),
        noiseDistortion: Math.max(0, Math.min(1, params.noiseDistortion)),
        colorShift: Math.max(0, Math.min(10, params.colorShift)),
        scanlines: Math.max(0, Math.min(1, params.scanlines)),
        interlaceGap: Math.max(1, Math.min(10, params.interlaceGap)),
        brightnessJitter: Math.max(0, Math.min(0.5, params.brightnessJitter)),
        trackingError: Math.max(0, Math.min(2, params.trackingError)),
        verticalJitter: Math.max(0, Math.min(1, params.verticalJitter)),
        tilt: Math.max(-0.5, Math.min(0.5, params.tilt)),
        randomSeed: Math.max(0, Math.min(1, params.randomSeed)),
        applyToTransparent: !!params.applyToTransparent
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        vhsColor: adjustColor(params.vhsColor)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        intensity: params.intensity,
        noise: params.noise,
        noiseDistortion: params.noiseDistortion,
        colorShift: params.colorShift * scaleFactor,
        scanlines: params.scanlines,
        interlaceGap: Math.max(
          1,
          Math.round(params.interlaceGap * scaleFactor)
        ),
        brightnessJitter: params.brightnessJitter,
        trackingError: params.trackingError * scaleFactor,
        verticalJitter: params.verticalJitter,
        tilt: params.tilt,
        randomSeed: params.randomSeed,
        enableVHSColor: params.enableVHSColor,
        vhsColor: params.vhsColor,
        applyToTransparent: params.applyToTransparent
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t22),
        noise: lerp(paramsA.noise, paramsB.noise, t22),
        noiseDistortion: lerp(
          paramsA.noiseDistortion,
          paramsB.noiseDistortion,
          t22
        ),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t22),
        scanlines: lerp(paramsA.scanlines, paramsB.scanlines, t22),
        interlaceGap: Math.round(
          lerp(paramsA.interlaceGap, paramsB.interlaceGap, t22)
        ),
        brightnessJitter: lerp(
          paramsA.brightnessJitter,
          paramsB.brightnessJitter,
          t22
        ),
        trackingError: lerp(paramsA.trackingError, paramsB.trackingError, t22),
        verticalJitter: lerp(paramsA.verticalJitter, paramsB.verticalJitter, t22),
        tilt: lerp(paramsA.tilt, paramsB.tilt, t22),
        randomSeed: lerp(paramsA.randomSeed, paramsB.randomSeed, t22),
        enableVHSColor: t22 < 0.5 ? paramsA.enableVHSColor : paramsB.enableVHSColor,
        vhsColor: {
          r: lerp(paramsA.vhsColor.r, paramsB.vhsColor.r, t22),
          g: lerp(paramsA.vhsColor.g, paramsB.vhsColor.g, t22),
          b: lerp(paramsA.vhsColor.b, paramsB.vhsColor.b, t22),
          a: lerp(paramsA.vhsColor.a, paramsB.vhsColor.a, t22)
        },
        applyToTransparent: t22 < 0.5 ? paramsA.applyToTransparent : paramsB.applyToTransparent
      };
    },
    renderUI: (params, { setParam }) => {
      const vhsColorStr = toColorCode(params.vhsColor);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "intensity", dataType: "float", min: 0, max: 2, value: params.intensity }),
            ui.numberInput({ key: "intensity", dataType: "float", value: params.intensity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("noise") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "noise", dataType: "float", min: 0, max: 1, value: params.noise }),
            ui.numberInput({ key: "noise", dataType: "float", value: params.noise })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("noiseDistortion") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "noiseDistortion", dataType: "float", min: 0, max: 1, value: params.noiseDistortion }),
            ui.numberInput({ key: "noiseDistortion", dataType: "float", value: params.noiseDistortion })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 10, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: "float", value: params.colorShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("scanlines") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "scanlines", dataType: "float", min: 0, max: 1, value: params.scanlines }),
            ui.numberInput({ key: "scanlines", dataType: "float", value: params.scanlines })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("interlaceGap") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "interlaceGap", dataType: "int", min: 1, max: 10, value: params.interlaceGap }),
            ui.numberInput({ key: "interlaceGap", dataType: "int", value: params.interlaceGap })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("brightnessJitter") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "brightnessJitter", dataType: "float", min: 0, max: 0.5, value: params.brightnessJitter }),
            ui.numberInput({ key: "brightnessJitter", dataType: "float", value: params.brightnessJitter })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("trackingError") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "trackingError", dataType: "float", min: 0, max: 2, value: params.trackingError }),
            ui.numberInput({ key: "trackingError", dataType: "float", value: params.trackingError })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("verticalJitter") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "verticalJitter", dataType: "float", min: 0, max: 1, value: params.verticalJitter }),
            ui.numberInput({ key: "verticalJitter", dataType: "float", value: params.verticalJitter })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("tilt") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "tilt", dataType: "float", min: -0.5, max: 0.5, value: params.tilt }),
            ui.numberInput({ key: "tilt", dataType: "float", value: params.tilt })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "enableVHSColor", value: params.enableVHSColor, label: t11("enableVHSColor") }),
          ui.group({ direction: "row" }, [
            ui.text({ text: t11("vhsColor") }),
            ui.colorInput({ key: "vhsColor", value: params.vhsColor }),
            ui.textInput({ key: "vhsColorText", value: vhsColorStr, onChange: (e) => {
              setParam({ vhsColor: parseColorCode(e.value) });
            } })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t11("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "randomSeed", dataType: "float", min: 0, max: 1, value: params.randomSeed }),
            ui.numberInput({ key: "randomSeed", dataType: "float", value: params.randomSeed })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "applyToTransparent", value: params.applyToTransparent, label: t11("applyToTransparent") })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(VHS & Interlace Effect)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiRatio: f32,
              intensity: f32,
              noise: f32,
              noiseDistortion: f32,
              colorShift: f32,
              scanlines: f32,
              interlaceGap: i32,
              brightnessJitter: f32,
              trackingError: f32,
              verticalJitter: f32,
              tilt: f32,
              enableVHSColor: i32,
              vhsColor: vec4f,
              seed: f32,
              applyToTransparent: i32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn rand(co: vec2f) -> f32 {
              return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            fn noise1D(x: f32) -> f32 {
              return fract(sin(x) * 10000.0);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let toInputTexCoord = dims / adjustedDims;
              let texCoord = vec2f(id.xy) / dims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) {
                return;
              }

              // \u30AA\u30EA\u30B8\u30CA\u30EB\u306E\u30AB\u30E9\u30FC\u3092\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // \u52B9\u679C\u306E\u5F37\u5EA6\u306B\u57FA\u3065\u3044\u3066\u52B9\u679C\u3092\u9069\u7528
              let effectStrength = params.intensity;
              if (effectStrength <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // \u900F\u660E\u90E8\u5206\u3092\u30B9\u30AD\u30C3\u30D7\u3059\u308B\u304B\u3069\u3046\u304B\u3092\u30C1\u30A7\u30C3\u30AF
              if (params.applyToTransparent == 0 && originalColor.a < 0.01) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // \u6700\u7D42\u7684\u306A\u8272\u3092\u521D\u671F\u5316
              var finalColor = originalColor;

              // \u57FA\u672C\u30D1\u30E9\u30E1\u30FC\u30BF\u3092\u8A2D\u5B9A
              let dpiRatio = params.dpiRatio;
              let tiltFactor = params.tilt;

              // \u7E26\u65B9\u5411\u306E\u6B6A\u307F\u3092\u8A08\u7B97
              var willSampleCoord = texCoord;
              let verticalDistortEffect = params.verticalJitter * effectStrength;

              if (verticalDistortEffect > 0.0) {
                // \u975E\u5468\u671F\u7684\u306A\u7E26\u65B9\u5411\u6B6A\u307F\u3092\u8A08\u7B97\uFF08\u6C34\u5E73\u4F4D\u7F6E\u3068\u30B7\u30FC\u30C9\u306B\u4F9D\u5B58\uFF09
                let xNoise = rand(vec2f(texCoord.x * 500.0, params.seed * 100.0)) * 2.0 - 1.0;
                let timeSeed = params.seed * 10.0;

                // \u7570\u306A\u308B\u5468\u6CE2\u6570\u306E\u6B6A\u307F\u3092\u7D44\u307F\u5408\u308F\u305B\u3066\u81EA\u7136\u306A\u63FA\u308C\u3092\u4F5C\u6210
                let verticalNoiseA = sin(texCoord.x * 150.0 + timeSeed) * 0.5;
                let verticalNoiseB = sin(texCoord.x * 370.0 + timeSeed * 1.5) * 0.3;
                let verticalNoiseC = noise1D(texCoord.x * 5.0 + timeSeed) * 0.2;

                // MAX_VERTICAL_JITTER_PIXELS\u304B\u3089\u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306E\u91CD\u307F\u3092\u8A08\u7B97
                let MAX_VERTICAL_JITTER_WEIGHT = ${MAX_VERTICAL_JITTER_PIXELS} * dpiRatio / f32(dims.y);

                // \u5782\u76F4\u30CE\u30A4\u30BA\u5024\u3092\u8A08\u7B97\u3057\u3001\u6B63\u898F\u5316\u7A7A\u9593\u306E\u91CD\u307F\u3067\u30B9\u30B1\u30FC\u30EA\u30F3\u30B0
                let verticalOffsetWeight = (verticalNoiseA + verticalNoiseB + verticalNoiseC + xNoise) * verticalDistortEffect * MAX_VERTICAL_JITTER_WEIGHT;

                // \u4E2D\u592E\u3092\u8EF8\u3068\u3057\u305F\u6B6A\u307F\u52B9\u679C\uFF08\u4E2D\u592E\u304B\u3089\u306E\u8DDD\u96E2\u306B\u5FDC\u3058\u3066\u5F37\u5EA6\u3092\u8ABF\u6574\uFF09
                let distanceFromCenter = abs(texCoord.x - 0.5);
                let centeredEffectWeight = verticalOffsetWeight * (1.0 + distanceFromCenter);

                // \u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306BY\u65B9\u5411\u306E\u30AA\u30D5\u30BB\u30C3\u30C8\u3092\u9069\u7528\uFF08\u65E2\u306B\u6B63\u898F\u5316\u7A7A\u9593\u306E\u91CD\u307F\uFF09
                willSampleCoord = vec2f(
                    texCoord.x,
                    texCoord.y + centeredEffectWeight
                );
              }

              finalColor = textureSampleLevel(inputTexture, textureSampler, willSampleCoord * toInputTexCoord, 0.0);

              // \u30CE\u30A4\u30BA\u52B9\u679C\u3092\u6B6A\u3093\u3060\u753B\u50CF\u306B\u9069\u7528
              {
                let noiseIntensity = params.noise * effectStrength * 0.8;
                let noiseDistortionEffect = params.noiseDistortion * effectStrength;

                // Compute base coordinates for noise sampling
                // (Rounded to original pixel grid for dpi-aware noise pattern)
                let baseNoiseCoordX = floor(willSampleCoord.x * dims.x / dpiRatio);
                let baseNoiseCoordY = floor(willSampleCoord.y * dims.y / dpiRatio);

                // \u30CE\u30A4\u30BA\u6B6A\u307F\u7528\u306E\u5EA7\u6A19\u8A08\u7B97 - \u30CE\u30A4\u30BA\u81EA\u4F53\u3092\u6B6A\u307E\u305B\u308B
                let noiseSeedX = baseNoiseCoordX * 0.03 /*(ad-lib)*/ ;
                let noiseSeedY = baseNoiseCoordY * 0.03 /*(ad-lib)*/ ;

                // \u30CE\u30A4\u30BA\u5EA7\u6A19\u81EA\u4F53\u306E\u6B6A\u307F\uFF08\u30CE\u30A4\u30BA\u81EA\u4F53\u3092\u6B6A\u307E\u305B\u308B - \u753B\u50CF\u3067\u306F\u306A\u304F\uFF09
                var distortedNoiseX = baseNoiseCoordX;
                var distortedNoiseY = baseNoiseCoordY;

                // Apply "noise distortion" to noise coordinates
                distortedNoiseX = baseNoiseCoordX + sin(noiseSeedX * 0.1 + params.seed * 50.0) * noiseDistortionEffect * 10.0;
                distortedNoiseY = baseNoiseCoordY + cos(noiseSeedY * 0.1 + params.seed * 60.0) * noiseDistortionEffect * 10.0;

                let noise1 = rand(vec2f(distortedNoiseX * 0.1, distortedNoiseY * 0.1 + params.seed * 10.0));
                let noise2 = rand(vec2f(distortedNoiseX * 0.05, distortedNoiseY * 0.05 - params.seed * 20.0));
                let noise3 = rand(vec2f(distortedNoiseX * 0.02, distortedNoiseY * 0.02 + params.seed * 30.0));
                let combinedNoise = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2) * noiseIntensity;

                // Add a random high-brightness noise spike (VHS "sparkle" effect)
                let sparkleThreshold = 0.97 - (noiseIntensity * 0.1); // \u30CE\u30A4\u30BA\u5F37\u5EA6\u306B\u5FDC\u3058\u3066\u95BE\u5024\u3092\u8ABF\u6574
                let sparkle = select(0.0, 1.0, noise1 > sparkleThreshold);

                let noiseColor = vec3f(combinedNoise);
                let adjustedNoise = (noiseColor - vec3f(0.5)) * noiseIntensity + vec3f(sparkle) * noiseIntensity;

                finalColor = vec4f(finalColor.rgb + adjustedNoise, finalColor.a);

                // \u900F\u660E\u90E8\u5206\u306B\u3082\u52B9\u679C\u3092\u4E0E\u3048\u308B\u5834\u5408\u306E\u30A2\u30EB\u30D5\u30A1\u5024\u8ABF\u6574
                if (params.applyToTransparent != 0 && finalColor.a < 0.01) {
                    let noiseAlpha = length(adjustedNoise) * 0.5;
                    finalColor.a = max(finalColor.a, noiseAlpha);
                }
              }

              // \u8272\u30BA\u30EC\u30A8\u30D5\u30A7\u30AF\u30C8\u3092\u9069\u7528
              if (params.colorShift > 0.0) {
                // \u8272\u30BA\u30EC\u52B9\u679C\u3092\u5927\u5E45\u306B\u5F37\u5316
                let colorShiftIntensity = params.colorShift * dpiRatio * effectStrength * 5.0;

                // \u30D4\u30AF\u30BB\u30EB\u5358\u4F4D\u3067\u306E\u6A2A\u65B9\u5411\u30B7\u30D5\u30C8\u91CF
                let redPixelShift = colorShiftIntensity;
                let bluePixelShift = -colorShiftIntensity * 0.7;

                // \u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306B\u5909\u63DB
                let redShift = redPixelShift / dims.x;
                let blueShift = bluePixelShift / dims.x;

                // \u5404\u8272\u30C1\u30E3\u30F3\u30CD\u30EB\u3092\u7570\u306A\u308B\u4F4D\u7F6E\u304B\u3089\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                let redTexCoord = vec2f(willSampleCoord.x + redShift, willSampleCoord.y);
                let blueTexCoord = vec2f(willSampleCoord.x + blueShift, willSampleCoord.y);

                let redSample = textureSampleLevel(
                    inputTexture,
                    textureSampler,
                    redTexCoord * toInputTexCoord,
                    0.0
                );

                let blueSample = textureSampleLevel(
                    inputTexture,
                    textureSampler,
                    blueTexCoord * toInputTexCoord,
                    0.0
                );

                let greenChannel = finalColor.g;

                let redAlpha = redSample.a;
                let blueAlpha = blueSample.a;

                let finalAlpha = max(redAlpha, max(blueAlpha, finalColor.a));

                // \u76F4\u63A5\u8272\u30C1\u30E3\u30F3\u30CD\u30EB\u3092\u7F6E\u304D\u63DB\u3048
                finalColor = vec4f(redSample.r, greenChannel, blueSample.b, finalAlpha);
              }

              // dpi\u306B\u4F9D\u5B58\u3057\u306A\u3044\u7269\u7406Y\u5EA7\u6A19\u3092\u8A08\u7B97
              let centeredX = willSampleCoord.x - 0.5;
              let basePhysicalY = f32(id.y) / dpiRatio;
              let tiltedPhysicalY = basePhysicalY - centeredX * tiltFactor * f32(dims.y) / dpiRatio;
              let physicalY = tiltedPhysicalY;

              // \u7269\u7406\u30B5\u30A4\u30BA\u30D9\u30FC\u30B9\u3067\u30A4\u30F3\u30BF\u30FC\u30EC\u30FC\u30B9\u306E\u9593\u9694\u3092\u8A08\u7B97
              let physicalGap = f32(params.interlaceGap);
              // \u30A4\u30F3\u30BF\u30FC\u30EC\u30FC\u30B9\u30E9\u30A4\u30F3\u304B\u3069\u3046\u304B\u3092\u5224\u5B9A
              let isInterlaceLine = (floor(physicalY) % (physicalGap * 2.0)) < physicalGap;

              if (isInterlaceLine) {
                finalColor = vec4f(finalColor.rgb * vec3f(1.05), finalColor.a);

                if (params.trackingError > 0.0) {
                  // \u30D4\u30AF\u30BB\u30EB\u30B0\u30EA\u30C3\u30C9\u306B\u5408\u308F\u305B\u305F\u30CE\u30A4\u30BA\u5EA7\u6A19\u306E\u8A08\u7B97\uFF08\u30CE\u30A4\u30BA\u52B9\u679C\u3068\u540C\u69D8\u306E\u30A2\u30D7\u30ED\u30FC\u30C1\uFF09
                  let baseNoiseCoordX = floor(willSampleCoord.x * dims.x / dpiRatio);
                  let baseNoiseCoordY = floor(physicalY);

                  // \u30C8\u30E9\u30C3\u30AD\u30F3\u30B0\u30A8\u30E9\u30FC\u306E\u5F37\u5EA6
                  let trackOffset = noise1D(baseNoiseCoordY * 0.1 + params.seed) * params.trackingError * effectStrength * 10.0;

                  // \u5404\u8272\u30C1\u30E3\u30F3\u30CD\u30EB\u3092\u7570\u306A\u308B\u30AA\u30D5\u30BB\u30C3\u30C8\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                  let redTexCoord = vec2f(willSampleCoord.x + trackOffset * 0.015, willSampleCoord.y);
                  let blueTexCoord = vec2f(willSampleCoord.x - trackOffset * 0.010, willSampleCoord.y);

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redTexCoord * toInputTexCoord, 0.0);
                  let greenSample = finalColor;
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueTexCoord * toInputTexCoord, 0.0);

                  // \u8272\u305A\u308C\u3057\u305F\u30A4\u30E1\u30FC\u30B8\u3092\u5408\u6210
                  let chromaOffset = vec4f(
                      redSample.r,
                      greenSample.g,
                      blueSample.b,
                      max(redSample.a, max(blueSample.a, finalColor.a))
                  );

                  // \u901A\u5E38\u306E\u30AA\u30D5\u30BB\u30C3\u30C8\u30AB\u30E9\u30FC
                  let offsetTexCoord = vec2f(willSampleCoord.x + trackOffset * 0.005, willSampleCoord.y);
                  let offsetColor = textureSampleLevel(inputTexture, textureSampler, offsetTexCoord * toInputTexCoord, 0.0);

                  // \u901A\u5E38\u306E\u30AA\u30D5\u30BB\u30C3\u30C8\u3068\u8272\u305A\u308C\u30AA\u30D5\u30BB\u30C3\u30C8\u3092\u7D44\u307F\u5408\u308F\u305B\u308B
                  finalColor = mix(
                      finalColor,
                      mix(offsetColor, chromaOffset, 0.7),
                      min(1.0, params.trackingError * effectStrength)
                  );
                }
              } else {
                finalColor = vec4f(finalColor.rgb * vec3f(0.95), finalColor.a);
              }

              if (params.scanlines > 0.0) {
                let scanlineIntensity = params.scanlines * effectStrength;
                // \u7269\u7406\u30B5\u30A4\u30BA\u30D9\u30FC\u30B9\u3067\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u306E\u5468\u6CE2\u6570\u3092\u8A08\u7B97
                let physicalScanY = willSampleCoord.y * dims.y / dpiRatio;

                // \u4E2D\u592E\u3092\u8EF8\u3068\u3057\u305F\u50BE\u659C\u8A08\u7B97
                let centeredX = willSampleCoord.x - 0.5; // \u6A2A\u65B9\u5411\u306E\u4E2D\u5FC3\u304B\u3089\u306E\u30AA\u30D5\u30BB\u30C3\u30C8
                // \u50BE\u659C\u3092\u9069\u7528\u3057\u3066\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3
                let tiltedScanY = physicalScanY - centeredX * params.tilt * f32(dims.y) / dpiRatio;
                let scanlineFreq = tiltedScanY * physicalGap;

                // \u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u306E\u4F4D\u7F6E
                let scanlinePhase = fract(scanlineFreq);

                // \u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u306E\u7AEF\u3067\u30C7\u30A3\u30B9\u30D7\u30EC\u30FC\u30B9\u30E1\u30F3\u30C8\u3092\u5F37\u3081\u308B
                let displaceIntensity = pow(abs(sin(scanlinePhase * 6.28318)), 8.0) * 0.5;

                // \u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u306B\u6CBF\u3063\u305F\u6C34\u5E73\u65B9\u5411\u306E\u5FAE\u5C0F\u306A\u30C7\u30A3\u30B9\u30D7\u30EC\u30FC\u30B9\u30E1\u30F3\u30C8
                let horizontalNoise = (rand(vec2f(tiltedScanY * 0.1, params.seed)) * 2.0 - 1.0);

                // \u52B9\u679C\u3092\u5F37\u5316
                let displacementAmount = horizontalNoise * displaceIntensity * 0.02 * scanlineIntensity;

                // \u30C7\u30A3\u30B9\u30D7\u30EC\u30FC\u30B9\u30E1\u30F3\u30C8\u3092\u9069\u7528\u3057\u305F\u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                let displacedCoord = vec2f(
                    willSampleCoord.x + displacementAmount,
                    willSampleCoord.y
                );
                let displacedColor = textureSampleLevel(inputTexture, textureSampler, displacedCoord * toInputTexCoord, 0.0);

                // \u901A\u5E38\u306E\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u52B9\u679C
                let scanlineValue = sin(scanlineFreq) * 0.5 + 0.5;
                let scanlineEffect = pow(scanlineValue, 1.0) * scanlineIntensity;

                // \u30C7\u30A3\u30B9\u30D7\u30EC\u30FC\u30B9\u30E1\u30F3\u30C8\u52B9\u679C\u3068\u901A\u5E38\u306E\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u52B9\u679C\u3092\u7D44\u307F\u5408\u308F\u305B\u308B
                finalColor = mix(finalColor, displacedColor, min(1.0, displaceIntensity * scanlineIntensity * 0.3));
                finalColor = vec4f(finalColor.rgb * vec3f(1.0 - scanlineEffect * 0.2), finalColor.a);

                // \u900F\u660E\u90E8\u5206\u306B\u3082\u30B9\u30AD\u30E3\u30F3\u30E9\u30A4\u30F3\u52B9\u679C\u3092\u4E0E\u3048\u308B\u5834\u5408
                if (params.applyToTransparent != 0 && finalColor.a < 0.01) {
                    let scanAlpha = scanlineEffect * 0.3;
                    finalColor.a = max(finalColor.a, scanAlpha);
                }
              }

              if (params.brightnessJitter > 0.0) {
                  let jitter = (rand(vec2f(params.seed, physicalY * 0.1)) * 2.0 - 1.0) * params.brightnessJitter * effectStrength;
                  finalColor = vec4f(finalColor.rgb * vec3f(1.0 + jitter), finalColor.a);
              }

              if (params.enableVHSColor != 0) {
                  let vhsColor = params.vhsColor;
                  finalColor = vec4f(mix(finalColor.rgb, vhsColor.rgb, vhsColor.a * effectStrength), finalColor.a);
              }

              finalColor = vec4f(clamp(finalColor.rgb, vec3f(0.0), vec3f(1.0)), finalColor.a);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "VHS & Interlace Effect Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions11(code);
          const bindGroupLayout = device.createBindGroupLayout({
            label: "VHS Effect Bind Group Layout",
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                  sampleType: "float",
                  viewDimension: "2d"
                }
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                  access: "write-only",
                  format: "rgba8unorm",
                  viewDimension: "2d"
                }
              },
              {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                sampler: {
                  type: "filtering"
                }
              },
              {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                  type: "uniform"
                }
              }
            ]
          });
          const pipelineLayout = device.createPipelineLayout({
            label: "VHS Effect Pipeline Layout",
            bindGroupLayouts: [bindGroupLayout]
          });
          const pipeline = device.createComputePipeline({
            label: "VHS & Interlace Effect Pipeline",
            layout: pipelineLayout,
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef, bindGroupLayout };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef, bindGroupLayout }, params, imgData, { dpi, baseDpi }) => {
      console.log("VHS & Interlace Effect V1", params);
      const dpiRatio = dpi / baseDpi;
      const colorShiftPadding = Math.ceil(params.colorShift * dpiRatio * 5);
      const verticalJitterPadding = Math.ceil(
        MAX_VERTICAL_JITTER_PIXELS * dpiRatio * params.verticalJitter
      );
      const maxPadding = Math.max(colorShiftPadding, verticalJitterPadding, 1);
      imgData = await paddingImageData(imgData, maxPadding + 10);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView11(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const seed = params.randomSeed * 1e4;
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiRatio,
        intensity: params.intensity,
        noise: params.noise,
        noiseDistortion: params.noiseDistortion,
        colorShift: params.colorShift,
        scanlines: params.scanlines,
        interlaceGap: params.interlaceGap,
        brightnessJitter: params.brightnessJitter,
        trackingError: params.trackingError,
        verticalJitter: params.verticalJitter,
        tilt: params.tilt,
        enableVHSColor: params.enableVHSColor ? 1 : 0,
        vhsColor: [
          params.vhsColor.r,
          params.vhsColor.g,
          params.vhsColor.b,
          params.vhsColor.a
        ],
        seed,
        applyToTransparent: params.applyToTransparent ? 1 : 0
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "VHS & Interlace Effect Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/downsampler.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions12,
  makeStructuredView as makeStructuredView12
} from "npm:webgpu-utils";
var t12 = createTranslator({
  en: {
    title: "Downsampler V1",
    mode: "Sampling Quality",
    bilinear: "Standard",
    bicubic: "Smooth",
    blocksX: "Horizontal Block Size",
    blocksY: "Vertical Block Size",
    linkAxes: "Link Axes",
    enableRefraction: "Enable Block Refraction",
    refraction: "Refraction Strength",
    seed: "Pattern Seed",
    patternType: "Refraction Pattern",
    blockPattern: "Block",
    ripplePattern: "Ripple",
    mixedPattern: "Mixed",
    rippleFrequency: "Ripple Frequency",
    rippleComplexity: "Ripple Complexity"
  },
  ja: {
    title: "\u30C0\u30A6\u30F3\u30B5\u30F3\u30D7\u30E9\u30FC V1",
    mode: "\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u54C1\u8CEA",
    bilinear: "\u3075\u3064\u3046",
    bicubic: "\u306A\u3081\u3089\u304B",
    blocksX: "\u6A2A\u65B9\u5411\u30D6\u30ED\u30C3\u30AF\u30B5\u30A4\u30BA",
    blocksY: "\u7E26\u65B9\u5411\u30D6\u30ED\u30C3\u30AF\u30B5\u30A4\u30BA",
    linkAxes: "\u7E26\u6A2A\u9023\u52D5",
    enableRefraction: "\u30D6\u30ED\u30C3\u30AF\u5C48\u6298\u3092\u6709\u52B9\u5316",
    refraction: "\u5C48\u6298\u7387",
    seed: "\u30D1\u30BF\u30FC\u30F3\u30B7\u30FC\u30C9",
    patternType: "\u5C48\u6298\u30D1\u30BF\u30FC\u30F3",
    blockPattern: "\u30D6\u30ED\u30C3\u30AF",
    ripplePattern: "\u6CE2\u7D0B",
    mixedPattern: "\u30DF\u30C3\u30AF\u30B9",
    rippleFrequency: "\u6CE2\u7D0B\u306E\u983B\u5EA6",
    rippleComplexity: "\u6CE2\u7D0B\u306E\u8907\u96D1\u3055"
  }
});
var MAX_BLOCKS = 48;
var downsampler = definePlugin({
  id: "downsampler-v1",
  title: t12("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      blocksX: {
        type: "real",
        default: 2
      },
      blocksY: {
        type: "real",
        default: 2
      },
      linkAxes: {
        type: "bool",
        default: true
      },
      mode: {
        type: "string",
        enum: ["bilinear", "bicubic"],
        default: "bilinear"
      },
      enableRefraction: {
        type: "bool",
        default: false
      },
      patternType: {
        type: "string",
        enum: ["block", "ripple", "mixed"],
        default: "block"
      },
      refraction: {
        type: "real",
        default: 0.1
      },
      seed: {
        type: "real",
        default: 1
      },
      rippleFrequency: {
        type: "real",
        default: 5
      },
      rippleComplexity: {
        type: "real",
        default: 3
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        blocksX: lerp(paramsA.blocksX, paramsB.blocksX, t22),
        blocksY: lerp(paramsA.blocksY, paramsB.blocksY, t22),
        linkAxes: t22 < 0.5 ? paramsA.linkAxes : paramsB.linkAxes,
        mode: t22 < 0.5 ? paramsA.mode : paramsB.mode,
        enableRefraction: t22 < 0.5 ? paramsA.enableRefraction : paramsB.enableRefraction,
        patternType: t22 < 0.5 ? paramsA.patternType : paramsB.patternType,
        refraction: lerp(paramsA.refraction, paramsB.refraction, t22),
        seed: lerp(paramsA.seed, paramsB.seed, t22),
        rippleFrequency: lerp(
          paramsA.rippleFrequency,
          paramsB.rippleFrequency,
          t22
        ),
        rippleComplexity: lerp(
          paramsA.rippleComplexity,
          paramsB.rippleComplexity,
          t22
        )
      };
    },
    renderUI: (params, { setParam }) => {
      const onChangeBlocksX = ({ value }) => {
        console.log({ value });
        setParam({ blocksX: value });
        if (params.linkAxes) setParam({ blocksY: value });
      };
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t12("mode") }),
          ui.select({
            key: "mode",
            value: params.mode,
            options: [
              { label: t12("bilinear"), value: "bilinear" },
              { label: t12("bicubic"), value: "bicubic" }
            ]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t12("blocksX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blocksX",
              dataType: "float",
              min: 1,
              max: MAX_BLOCKS,
              value: params.blocksX,
              onChange: onChangeBlocksX
            }),
            ui.numberInput({ key: "blocksX", dataType: "float", value: params.blocksX })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t12("blocksY") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blocksY",
              dataType: "float",
              disabled: params.linkAxes,
              min: 1,
              max: MAX_BLOCKS,
              value: params.blocksY
            }),
            ui.numberInput({
              key: "blocksY",
              dataType: "float",
              disabled: params.linkAxes,
              value: params.blocksY
            })
          ])
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "linkAxes", value: params.linkAxes, label: t12("linkAxes") })
        ]),
        ui.separator(),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "enableRefraction", value: params.enableRefraction, label: t12("enableRefraction") })
        ]),
        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t12("patternType") }),
          ui.select({
            key: "patternType",
            value: params.patternType,
            options: [
              { label: t12("blockPattern"), value: "block" },
              { label: t12("ripplePattern"), value: "ripple" },
              { label: t12("mixedPattern"), value: "mixed" }
            ]
          })
        ]),
        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t12("refraction") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "refraction",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.refraction
            }),
            ui.numberInput({ key: "refraction", dataType: "float", value: params.refraction })
          ])
        ]),
        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t12("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "seed",
              dataType: "float",
              min: 0.1,
              max: 100,
              value: params.seed
            }),
            ui.numberInput({ key: "seed", dataType: "float", value: params.seed })
          ])
        ]),
        ui.group({
          direction: "col",
          disabled: !params.enableRefraction || params.patternType === "block"
        }, [
          ui.text({ text: t12("rippleFrequency") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "rippleFrequency",
              dataType: "float",
              min: 1,
              max: 20,
              value: params.rippleFrequency
            }),
            ui.numberInput({ key: "rippleFrequency", dataType: "float", value: params.rippleFrequency })
          ])
        ]),
        ui.group({
          direction: "col",
          disabled: !params.enableRefraction || params.patternType === "block"
        }, [
          ui.text({ text: t12("rippleComplexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "rippleComplexity",
              dataType: "float",
              min: 1,
              max: 10,
              value: params.rippleComplexity
            }),
            ui.numberInput({ key: "rippleComplexity", dataType: "float", value: params.rippleComplexity })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Downsampler)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              blocksX: f32,
              blocksY: f32,
              mode: i32,            // 0: bilinear, 1: bicubic
              enableRefraction: i32, // 0: disabled, 1: enabled
              patternType: i32,     // 0: block, 1: ripple, 2: mixed
              refraction: f32,
              seed: f32,
              rippleFrequency: f32,
              rippleComplexity: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Hash function for pseudo-random number generation
            fn hash21(p: vec2f) -> f32 {
              var n = dot(p, vec2f(127.1, 311.7));
              return fract(sin(n) * 43758.5453);
            }

            // Cubic weight function for bicubic sampling
            fn cubicWeight(x: f32) -> f32 {
              let absX = abs(x);
              if (absX < 1.0) {
                return (1.5 * absX - 2.5) * absX * absX + 1.0;
              } else if (absX < 2.0) {
                return ((-0.5 * absX + 2.5) * absX - 4.0) * absX + 2.0;
              }
              return 0.0;
            }

            // Bicubic texture sampling at a given coordinate with pre-calculated dimensions
            fn sampleBicubic(texCoord: vec2f, dims: vec2f, scale: vec2f) -> vec4f {
              let adjustedCoord = texCoord * scale;

              let texelSize = 1.0 / dims;

              let tc = adjustedCoord * dims - 0.5;
              let fxy = fract(tc);
              let ixy = tc - fxy;

              // Calculate bicubic weights
              var wx: array<f32, 4>;
              var wy: array<f32, 4>;

              for (var i = 0u; i < 4u; i++) {
                wx[i] = cubicWeight(f32(i) - 1.0 - fxy.x);
                wy[i] = cubicWeight(f32(i) - 1.0 - fxy.y);
              }

              // Normalize weights
              let sumX = wx[0] + wx[1] + wx[2] + wx[3];
              let sumY = wy[0] + wy[1] + wy[2] + wy[3];

              for (var i = 0u; i < 4u; i++) {
                wx[i] = wx[i] / sumX;
                wy[i] = wy[i] / sumY;
              }

              var color = vec4f(0.0);

              // Sample 16 texels and apply weights
              for (var y = 0u; y < 4u; y++) {
                for (var x = 0u; x < 4u; x++) {
                  let samplePos = vec2f(
                    (ixy.x + f32(x) - 1.0) * texelSize.x,
                    (ixy.y + f32(y) - 1.0) * texelSize.y
                  );

                  // Clamp to valid texture coordinates
                  let clampedPos = clamp(samplePos, vec2f(0.0), vec2f(1.0) - texelSize);
                  let sample = textureSampleLevel(inputTexture, textureSampler, clampedPos, 0.0);

                  color += sample * wx[x] * wy[y];
                }
              }

              return color;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let textureDims = vec2f(textureDimensions(inputTexture));
              let outputDims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / outputDims;
              let toInputTexCoord = outputDims / textureDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let blocksX = params.blocksX;
              let blocksY = params.blocksY;

              let blockX = floor(texCoord.x * blocksX);
              let blockY = floor(texCoord.y * blocksY);
              let blockPos = vec2f(blockX, blockY);

              let blockUV = fract(texCoord * vec2f(blocksX, blocksY));

              let scaledCoordX = (blockX + 0.5) / blocksX;
              let scaledCoordY = (blockY + 0.5) / blocksY;

              // Base sampling coordinate (block center)
              var downscaledCoord = vec2f(scaledCoordX, scaledCoordY);

              // Apply refraction if enabled
              if (params.enableRefraction != 0) {
                var displacement = vec2f(0.0);

              if (params.patternType == 0) { // Block pattern
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                displacement = blockDir * distanceFromCenter;
                } else if (params.patternType == 1) { // Ripple pattern
                var combinedDisplacement = vec2f(0.0);
                let maxCenters = min(params.rippleComplexity * 2.0, 12.0);

                let seedOffset = vec2f(sin(params.seed * 0.1), cos(params.seed * 0.1));
                let p = texCoord + seedOffset;

                let mainCenter = vec2f(0.5) + vec2f(sin(params.seed * 0.753) * 0.2, cos(params.seed * 0.371) * 0.2);

                for (var c = 0.0; c < maxCenters; c += 1.0) {
                  let centerOffset = vec2f(
                    sin(params.seed * 1.7 + c * 3.33) * 0.3,
                    cos(params.seed * 2.1 + c * 2.72) * 0.3
                  );

                  let center = mainCenter + centerOffset * (0.4 + c * 0.05);
                  let baseDistance = length(p - center);
                  let noiseScale = hash21(p * (c + 1.0) + vec2f(params.seed)) * 0.15;
                  let distortedDist = baseDistance * (1.0 + noiseScale);
                  let centerFreq = params.rippleFrequency * (0.8 + hash21(vec2f(c, params.seed)) * 0.4);
                  let phase = params.seed * (c + 1.0) * 0.3;

                  let rippleValue = sin(distortedDist * centerFreq * 6.28 + phase);
                  let dir = normalize(p - center);
                  let strength = (1.0 / (c + 1.0)) * 0.5;
                  let organicFactor = sin(distortedDist * centerFreq * 3.14 + phase * 1.5) * 0.2;

                  let warpedDir = vec2f(
                    dir.x + sin(dir.y * 5.0 + params.seed) * 0.2,
                    dir.y + cos(dir.x * 5.0 + params.seed) * 0.2
                  );

                  combinedDisplacement += warpedDir * (rippleValue + organicFactor) * strength;
                }

                displacement = combinedDisplacement;
                } else if (params.patternType == 2) { // Mixed pattern
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                let blockDisp = blockDir * distanceFromCenter;

                  // Ripple pattern
                  let seedOffset = vec2f(sin(params.seed * 0.1), cos(params.seed * 0.1));
                  let p = texCoord + seedOffset;
                  let center = vec2f(0.5) + vec2f(sin(params.seed * 0.753) * 0.2, cos(params.seed * 0.371) * 0.2);
                  let dist = length(p - center);
                  let baseRipple = sin(dist * params.rippleFrequency * 6.28);

                  var rippleSum = baseRipple;
                  let maxComplexity = min(params.rippleComplexity, 10.0);

                  for (var i = 1.0; i < maxComplexity; i += 1.0) {
                    let offset = vec2f(
                      sin(params.seed * 0.1 + i * 0.37),
                      cos(params.seed * 0.1 + i * 0.53)
                    ) * 0.4;

                    let altCenter = center + offset;
                    let altDist = length(p - altCenter);
                    let altFreq = params.rippleFrequency * (0.5 + i * 0.2);
                    let altPhase = params.seed * i * 0.1;
                    let altRipple = sin(altDist * altFreq * 6.28 + altPhase);
                    rippleSum += altRipple / i;
                  }

                  rippleSum /= maxComplexity;
                  let dir = normalize(p - center);
                  let rippleDisp = dir * rippleSum;

                  // Mix both patterns
                  displacement = blockDisp * 0.5 + rippleDisp * 0.5;
                } else { // Default fallback to block
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                displacement = blockDir * distanceFromCenter;
                }

                // Scale displacement by refraction strength
                let refractStrength = params.refraction * 0.2;
                downscaledCoord += displacement * refractStrength;

                // Clamp to prevent sampling outside texture
                downscaledCoord = clamp(downscaledCoord, vec2f(0.0), vec2f(1.0));
              }

              let finalSampleCoord = downscaledCoord * toInputTexCoord;

              var finalColor: vec4f;

              if (params.mode == 0) { // Bilinear
                finalColor = textureSampleLevel(inputTexture, textureSampler, finalSampleCoord, 0.0);
              } else { // Bicubic
                finalColor = sampleBicubic(downscaledCoord, textureDims, toInputTexCoord);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Downsampler Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions12(code);
          const pipeline = device.createComputePipeline({
            label: "Downsampler Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log(
        "Downsampler V1",
        params,
        "Device DPI:",
        dpi,
        "Base DPI:",
        baseDpi,
        "Raw size:",
        imgData.width,
        "x",
        imgData.height
      );
      const modeValue = params.mode === "bilinear" ? 0 : 1;
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width;
      const inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView12(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        blocksX: params.blocksX,
        blocksY: params.blocksY,
        mode: modeValue,
        enableRefraction: params.enableRefraction ? 1 : 0,
        patternType: params.patternType === "block" ? 0 : params.patternType === "ripple" ? 1 : 2,
        refraction: params.refraction,
        seed: params.seed,
        rippleFrequency: params.rippleFrequency,
        rippleComplexity: params.rippleComplexity
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Downsampler Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/wave-distortion.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions13,
  makeStructuredView as makeStructuredView13
} from "npm:webgpu-utils";
var t13 = createTranslator({
  en: {
    title: "Wave Distortion",
    amplitude: "Amplitude",
    frequency: "Frequency",
    angle: "Angle",
    presets: "Presets",
    horizontal: "Horizontal",
    vertical: "Vertical",
    diagonal: "Diagonal",
    crossWave: "Cross Wave",
    time: "Time"
  },
  ja: {
    title: "\u30A6\u30A7\u30FC\u30D6 \u30C7\u30A3\u30B9\u30C8\u30FC\u30B7\u30E7\u30F3",
    amplitude: "\u632F\u5E45",
    frequency: "\u5468\u6CE2\u6570",
    angle: "\u89D2\u5EA6",
    presets: "\u30D7\u30EA\u30BB\u30C3\u30C8",
    horizontal: "\u6C34\u5E73",
    vertical: "\u5782\u76F4",
    diagonal: "\u659C\u3081",
    crossWave: "\u4EA4\u5DEE\u6CE2",
    time: "\u6642\u9593"
  }
});
var waveDistortion = definePlugin({
  id: "wave-distortion-v1",
  title: t13("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      amplitude: {
        type: "real",
        default: 50
      },
      frequency: {
        type: "real",
        default: 5
      },
      angleValue: {
        type: "real",
        default: 0
      },
      crossWave: {
        type: "bool",
        default: false
      },
      time: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        amplitude: params.amplitude * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        amplitude: lerp(paramsA.amplitude, paramsB.amplitude, t22),
        frequency: lerp(paramsA.frequency, paramsB.frequency, t22),
        angleValue: lerp(paramsA.angleValue, paramsB.angleValue, t22),
        crossWave: t22 < 0.5 ? paramsA.crossWave : paramsB.crossWave,
        time: lerp(paramsA.time, paramsB.time, t22)
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t13("amplitude") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "amplitude", dataType: "float", min: 0, max: 300, value: params.amplitude }),
            ui.numberInput({ key: "amplitude", dataType: "float", value: params.amplitude })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t13("frequency") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "frequency", dataType: "float", min: 0.1, max: 100, value: params.frequency }),
            ui.numberInput({ key: "frequency", dataType: "float", value: params.frequency })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t13("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angleValue", dataType: "float", min: 0, max: 360, value: params.angleValue }),
            ui.numberInput({ key: "angleValue", dataType: "float", value: params.angleValue })
          ]),
          ui.group({ direction: "row" }, [
            ui.button({ text: t13("horizontal"), onClick: () => setParam({ angleValue: 0 }) }),
            ui.button({ text: t13("vertical"), onClick: () => setParam({ angleValue: 90 }) }),
            ui.button({ text: t13("diagonal"), onClick: () => setParam({ angleValue: 45 }) })
          ])
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "crossWave", label: t13("crossWave"), value: params.crossWave })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t13("time") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "time", dataType: "float", min: 0, max: 100, value: params.time }),
            ui.numberInput({ key: "time", dataType: "float", value: params.time })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Wave Distortion)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              amplitude: f32,
              frequency: f32,
              angleRad: f32,
              crossWave: f32,
              time: f32,
              paddingSize: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn rotate2DAroundOrigin(coord: vec2f, angle: f32) -> vec2f {
              let sinVal = sin(angle);
              let cosVal = cos(angle);

              return vec2f(
                coord.x * cosVal - coord.y * sinVal,
                coord.x * sinVal + coord.y * cosVal
              );
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              // DPI\u30B9\u30B1\u30FC\u30EA\u30F3\u30B0: \u5165\u529BDPI\u3068\u30D9\u30FC\u30B9DPI\uFF08\u57FA\u6E96\u5024\uFF09\u306E\u6BD4\u7387
              let dpiScale = params.dpiScale;

              // \u632F\u5E45\u30D1\u30E9\u30E1\u30FC\u30BF\u306BDPI\u30B9\u30B1\u30FC\u30EB\u3092\u9069\u7528
              let pixelNorm = vec2f(1.0) / dims;
              let amplitudeNorm = pixelNorm * vec2f(params.amplitude * dpiScale);

              let frequency = params.frequency * 3.14159;

              // Normalize coordinates to center
              let centerCoord = texCoord * 2.0 - 1.0;

              // Calculate main wave based on angle
              let rotatedCoord = rotate2DAroundOrigin(centerCoord, params.angleRad);

              // \u6CE2\u306E\u4F4D\u76F8\u3092\u8A08\u7B97
              let wavePhase = rotatedCoord.x * frequency;
              let crossWavePhase = rotatedCoord.y * frequency;

              // \u30D4\u30AF\u30BB\u30EB\u5358\u4F4D\u306E\u632F\u5E45\u3092\u8A08\u7B97\u3057\u3001\u6B63\u898F\u5316\u5EA7\u6A19\u7CFB\u306B\u5909\u63DB\u3057\u3066\u9069\u7528
              let distortion = sin(wavePhase + params.time * 0.1) * amplitudeNorm.y;
              let distortedY = rotatedCoord.y + distortion;

              // \u30AF\u30ED\u30B9\u6CE2\u3067\u3082\u540C\u69D8\u306B\u6B63\u898F\u5316\u3057\u3066\u9069\u7528
              let crossDistortion = sin(crossWavePhase + params.time * 0.1) * amplitudeNorm.x * params.crossWave;
              let distortedX = rotatedCoord.x + crossDistortion;

              // Create distorted coordinate
              let distortedCoord = vec2f(distortedX, distortedY);

              // Rotate back to original orientation
              let finalRotatedCoord = rotate2DAroundOrigin(distortedCoord, -params.angleRad);

              // Convert back to texture coordinates
              let finalCoord = (finalRotatedCoord + 1.0) * 0.5;

              // Clamp coordinates to prevent sampling outside texture bounds
              let clampedCoord = clamp(finalCoord, vec2f(0.0), vec2f(1.0));

              // Sample the texture with the distorted coordinates
              let finalColor = textureSampleLevel(inputTexture, textureSampler, clampedCoord * toInputTexCoord, 0.0);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Wave Distortion Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions13(code);
          const pipeline = device.createComputePipeline({
            label: "Wave Distortion Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Wave Distortion", params);
      const dpiScale = dpi / baseDpi;
      const sourceWidth = imgData.width;
      const sourceHeight = imgData.height;
      const paddingSize = Math.ceil(params.amplitude / 2 * dpiScale);
      imgData = await paddingImageData(imgData, paddingSize);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView13(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const angleRad = params.angleValue * Math.PI / 180;
      const dpiRatio = baseDpi / 72;
      const referenceWidth = sourceWidth / dpiRatio;
      const referenceHeight = sourceHeight / dpiRatio;
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        sourceSize: [referenceWidth, referenceHeight],
        amplitude: params.amplitude,
        frequency: params.frequency,
        angleRad,
        crossWave: params.crossWave ? 1 : 0,
        time: params.time,
        paddingSize: paddingSize + (inputWidth - outputWidth) / 2
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Wave Distortion Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Wave Distortion Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/selective-color-correction.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions14,
  makeStructuredView as makeStructuredView14
} from "npm:webgpu-utils";
var t14 = createTranslator({
  en: {
    title: "Color Correction V1",
    conditionTitle: "Color Range Settings",
    condition: "Filter",
    targetColor: "Target Color",
    colorDistance: "Color Distance",
    hsvMode: "HSV Mode",
    hue: "Hue",
    hueRange: "Hue Range",
    saturation: "Saturation",
    saturationRange: "Saturation Range",
    brightness: "Brightness",
    brightnessRange: "Brightness Range",
    adjustments: "Adjustments",
    hueShift: "Hue Shift",
    saturationScale: "Saturation",
    brightnessScale: "Brightness",
    contrast: "Contrast",
    mix: "Mix",
    blendMode: "Blend Mode",
    normal: "Normal",
    add: "Add",
    multiply: "Multiply",
    featherEdges: "Feather Edges",
    previewMask: "Preview Selected Area",
    advanced: "Advanced Settings"
  },
  ja: {
    title: "\u8272\u8ABF\u88DC\u6B63 V1",
    conditionTitle: "\u5BFE\u8C61\u8272\u306E\u7BC4\u56F2",
    condition: "\u30D5\u30A3\u30EB\u30BF",
    targetColor: "\u5BFE\u8C61\u8272",
    colorDistance: "\u8272\u306E\u8DDD\u96E2",
    hsvMode: "HSV\u30E2\u30FC\u30C9",
    hue: "\u8272\u76F8",
    hueRange: "\u8272\u76F8\u7BC4\u56F2",
    saturation: "\u5F69\u5EA6",
    saturationRange: "\u5F69\u5EA6\u7BC4\u56F2",
    brightness: "\u660E\u5EA6",
    brightnessRange: "\u660E\u5EA6\u7BC4\u56F2",
    adjustments: "\u8ABF\u6574",
    hueShift: "\u8272\u76F8\u30B7\u30D5\u30C8",
    saturationScale: "\u5F69\u5EA6",
    brightnessScale: "\u660E\u5EA6",
    contrast: "\u30B3\u30F3\u30C8\u30E9\u30B9\u30C8",
    mix: "\u30DF\u30C3\u30AF\u30B9",
    blendMode: "\u30D6\u30EC\u30F3\u30C9\u30E2\u30FC\u30C9",
    normal: "\u901A\u5E38",
    add: "\u52A0\u7B97",
    multiply: "\u4E57\u7B97",
    featherEdges: "\u30A8\u30C3\u30B8\u3092\u307C\u304B\u3059",
    previewMask: "\u9078\u629E\u7BC4\u56F2\u3092\u30D7\u30EC\u30D3\u30E5\u30FC",
    advanced: "\u8A73\u7D30\u8A2D\u5B9A"
  }
});
var defaultCondition = {
  targetHue: 0,
  hueRange: 180,
  // 180以上で「すべての色相」を意味する
  saturationMin: 0,
  saturationMax: 1,
  brightnessMin: 0,
  brightnessMax: 1
};
var selectiveColorCorrection = definePlugin({
  id: "color-correction-v1",
  title: t14("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      // ブレンドモード
      blendMode: {
        type: "string",
        enum: ["normal", "multiply"],
        default: "normal"
      },
      // ミックス (色調補正の適用度合い)
      mix: {
        type: "real",
        default: 1
      },
      // エッジぼかし
      featherEdges: {
        type: "real",
        default: 0.2
      },
      // マスクプレビュー
      previewMask: {
        type: "bool",
        default: false
      },
      // 条件を表示するかどうか
      useCondition: {
        type: "bool",
        default: false
      },
      // 色選択パラメータ
      targetHue: {
        type: "real",
        default: 0
      },
      hueRange: {
        type: "real",
        default: 180
        // 180以上で「すべての色相」を意味する
      },
      saturationMin: {
        type: "real",
        default: 0
      },
      saturationMax: {
        type: "real",
        default: 1
      },
      brightnessMin: {
        type: "real",
        default: 0
      },
      brightnessMax: {
        type: "real",
        default: 1
      },
      // 調整パラメータ
      hueShift: {
        type: "real",
        default: 0
      },
      saturationScale: {
        type: "real",
        default: 0
        // -1〜1の範囲 (0がニュートラル)
      },
      brightnessScale: {
        type: "real",
        default: 0
        // -1〜1の範囲 (0がニュートラル)
      },
      contrast: {
        type: "real",
        default: 0
        // -1〜1の範囲 (0がニュートラル)
      }
    },
    onAdjustColors: (params, adjustColor) => {
      const dummy = { r: 1, g: 0, b: 0, a: 0 };
      return params;
    },
    onEditParameters: (params) => {
      const normalizedParams = { ...params };
      normalizedParams.targetHue = (normalizedParams.targetHue % 360 + 360) % 360;
      normalizedParams.hueRange = Math.max(
        0,
        Math.min(180, normalizedParams.hueRange)
      );
      normalizedParams.saturationMin = Math.max(
        0,
        Math.min(1, normalizedParams.saturationMin)
      );
      normalizedParams.saturationMax = Math.max(
        normalizedParams.saturationMin,
        Math.min(1, normalizedParams.saturationMax)
      );
      normalizedParams.brightnessMin = Math.max(
        0,
        Math.min(1, normalizedParams.brightnessMin)
      );
      normalizedParams.brightnessMax = Math.max(
        normalizedParams.brightnessMin,
        Math.min(1, normalizedParams.brightnessMax)
      );
      normalizedParams.hueShift = Math.max(
        -180,
        Math.min(180, normalizedParams.hueShift)
      );
      normalizedParams.saturationScale = Math.max(
        -1,
        Math.min(1, normalizedParams.saturationScale)
      );
      normalizedParams.brightnessScale = Math.max(
        -1,
        Math.min(1, normalizedParams.brightnessScale)
      );
      normalizedParams.contrast = Math.max(
        -1,
        Math.min(1, normalizedParams.contrast)
      );
      normalizedParams.mix = Math.max(0, Math.min(1, normalizedParams.mix));
      normalizedParams.featherEdges = Math.max(
        0,
        Math.min(1, params.featherEdges)
      );
      return normalizedParams;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      const result = {
        blendMode: t22 < 0.5 ? paramsA.blendMode : paramsB.blendMode,
        previewMask: t22 < 0.5 ? paramsA.previewMask : paramsB.previewMask,
        useCondition: t22 < 0.5 ? paramsA.useCondition : paramsB.useCondition,
        // 数値パラメータの線形補間
        mix: lerp(paramsA.mix, paramsB.mix, t22),
        featherEdges: lerp(paramsA.featherEdges, paramsB.featherEdges, t22),
        // 色選択パラメータの補間
        targetHue: lerp(paramsA.targetHue, paramsB.targetHue, t22),
        hueRange: lerp(paramsA.hueRange, paramsB.hueRange, t22),
        saturationMin: lerp(paramsA.saturationMin, paramsB.saturationMin, t22),
        saturationMax: lerp(paramsA.saturationMax, paramsB.saturationMax, t22),
        brightnessMin: lerp(paramsA.brightnessMin, paramsB.brightnessMin, t22),
        brightnessMax: lerp(paramsA.brightnessMax, paramsB.brightnessMax, t22),
        // 調整パラメータの補間
        hueShift: lerp(paramsA.hueShift, paramsB.hueShift, t22),
        saturationScale: lerp(
          paramsA.saturationScale,
          paramsB.saturationScale,
          t22
        ),
        brightnessScale: lerp(
          paramsA.brightnessScale,
          paramsB.brightnessScale,
          t22
        ),
        contrast: lerp(paramsA.contrast, paramsB.contrast, t22)
      };
      return result;
    },
    renderUI: (params, { setParam }) => {
      const adjustmentsComponent = ui.group({ direction: "col" }, [
        // 色相シフト
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("hueShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "hueShift",
              dataType: "float",
              min: -180,
              max: 180,
              value: params.hueShift
            }),
            ui.numberInput({
              key: "hueShift",
              dataType: "float",
              value: params.hueShift
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ hueShift: 0 });
              }
            })
          ])
        ]),
        // 彩度調整
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("saturationScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "saturationScale",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.saturationScale
            }),
            ui.numberInput({
              key: "saturationScale",
              dataType: "float",
              value: params.saturationScale
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ saturationScale: 0 });
              }
            })
          ])
        ]),
        // 明度調整
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("brightnessScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brightnessScale",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.brightnessScale
            }),
            ui.numberInput({
              key: "brightnessScale",
              dataType: "float",
              value: params.brightnessScale
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ brightnessScale: 0 });
              }
            })
          ])
        ]),
        // コントラスト
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("contrast") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "contrast",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.contrast
            }),
            ui.numberInput({
              key: "contrast",
              dataType: "float",
              value: params.contrast
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ contrast: 0 });
              }
            })
          ])
        ]),
        // ミックス
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("mix") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "mix",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.mix
            }),
            ui.numberInput({
              key: "mix",
              dataType: "float",
              value: params.mix
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ mix: 1 });
              }
            })
          ])
        ])
      ]);
      const colorConditionComponent = ui.group({ direction: "col" }, [
        // 選択範囲をプレビュー（色選択条件セクション内の一番上に移動）
        ui.checkbox({
          key: "previewMask",
          value: params.previewMask,
          label: t14("previewMask")
        }),
        // エッジをぼかす（選択範囲をプレビューの下に配置）
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("featherEdges") }),
          ui.slider({
            key: "featherEdges",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.featherEdges
          })
        ]),
        ui.separator(),
        // 色相設定
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("hue") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "targetHue",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.targetHue
            }),
            ui.numberInput({
              key: "targetHue",
              dataType: "float",
              value: params.targetHue
            })
          ])
        ]),
        // 色相範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("hueRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "hueRange",
              dataType: "float",
              min: 0,
              max: 180,
              value: params.hueRange
            }),
            ui.numberInput({
              key: "hueRange",
              dataType: "float",
              value: params.hueRange
            })
          ])
        ]),
        // 彩度範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("saturationRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "saturationMin",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.saturationMin
            }),
            ui.text({ text: "-" }),
            ui.slider({
              key: "saturationMax",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.saturationMax
            })
          ])
        ]),
        // 明度範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t14("brightnessRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brightnessMin",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.brightnessMin
            }),
            ui.text({ text: "-" }),
            ui.slider({
              key: "brightnessMax",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.brightnessMax
            })
          ])
        ])
      ]);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.group({ direction: "row" }, [
            ui.text({ text: t14("blendMode") }),
            ui.select({
              key: "blendMode",
              value: params.blendMode,
              options: [
                { label: t14("normal"), value: "normal" },
                { label: t14("multiply"), value: "multiply" }
              ]
            })
          ])
        ]),
        ui.separator(),
        ui.text({ text: t14("adjustments") }),
        adjustmentsComponent,
        ui.separator(),
        ui.checkbox({
          key: "useCondition",
          value: params.useCondition,
          label: t14("conditionTitle")
        }),
        // 条件セクション（チェックボックスがオンの場合のみ表示）
        params.useCondition ? colorConditionComponent : null
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Selective Color Correction)" }
        },
        (device) => {
          const code = `
            struct ColorCondition {
              targetHue: f32,
              hueRange: f32,
              saturationMin: f32,
              saturationMax: f32,
              brightnessMin: f32,
              brightnessMax: f32,
              hueShift: f32,
              saturationScale: f32,
              brightnessScale: f32,
              contrast: f32,
            }

            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              blendMode: i32,  // 0: normal, 1: multiply
              featherEdges: f32,
              previewMask: i32,
              mix: f32,
              @align(16) condition: ColorCondition,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // RGB to HSV conversion
            fn rgb2hsv(rgb: vec3f) -> vec3f {
              let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
              let p = mix(vec4f(rgb.bg, K.wz), vec4f(rgb.gb, K.xy), step(rgb.b, rgb.g));
              let q = mix(vec4f(p.xyw, rgb.r), vec4f(rgb.r, p.yzx), step(p.x, rgb.r));

              let d = q.x - min(q.w, q.y);
              let e = 1.0e-10;

              return vec3f(
                abs(q.z + (q.w - q.y) / (6.0 * d + e)),
                d / (q.x + e),
                q.x
              );
            }

            // HSV to RGB conversion
            fn hsv2rgb(hsv: vec3f) -> vec3f {
              let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
              let p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);

              return hsv.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), hsv.y);
            }

            // \u8272\u6761\u4EF6\u306B\u57FA\u3065\u304F\u30DE\u30C3\u30C1\u4FC2\u6570\u3092\u8A08\u7B97
            fn calculateMatchFactor(hsv: vec3f, condition: ColorCondition, featherAmount: f32) -> f32 {
              // \u8272\u76F8\u7BC4\u56F2\u304C360\u5EA6\uFF08\u307E\u305F\u306F\u5341\u5206\u5927\u304D\u3044\u5024\uFF09\u306E\u5834\u5408\u3001\u3059\u3079\u3066\u306E\u8272\u76F8\u304C\u30DE\u30C3\u30C1\u3059\u308B\u3068\u307F\u306A\u3059
              let isFullHueRange = condition.hueRange >= 180.0;

              var hueMatch = 0.0;
              if (isFullHueRange) {
                // \u8272\u76F8\u7BC4\u56F2\u304C\u6700\u5927\u306E\u5834\u5408\u306F\u3001\u8272\u76F8\u306B\u95A2\u4FC2\u306A\u304F\u5B8C\u5168\u30DE\u30C3\u30C1
                hueMatch = 1.0;
              } else {
                // \u8272\u76F8\u30920-1\u306B\u6B63\u898F\u5316
                let targetHueNorm = condition.targetHue / 360.0;
                let hueRangeNorm = condition.hueRange / 360.0;

                // \u8272\u76F8\u306E\u8DDD\u96E2\u3092\u8A08\u7B97\uFF08\u8272\u76F8\u306F\u5FAA\u74B0\u3059\u308B\u306E\u3067\u6700\u77ED\u8DDD\u96E2\u3092\u8003\u616E\uFF09
                var hueDist = abs(hsv.x - targetHueNorm);
                hueDist = min(hueDist, 1.0 - hueDist); // \u5FAA\u74B0\u6027\u3092\u8003\u616E

                // \u8272\u76F8\u306E\u30DE\u30C3\u30C1\u5EA6\u3092\u8A08\u7B97\uFF08\u30D5\u30A7\u30B6\u30EA\u30F3\u30B0\u3092\u8003\u616E\uFF09
                if (hueDist <= hueRangeNorm) {
                  // \u30A8\u30C3\u30B8\u3092\u307C\u304B\u3059\u305F\u3081\u306E\u30B9\u30E0\u30FC\u30B9\u30B9\u30C6\u30C3\u30D7
                  if (featherAmount > 0.0) {
                    let featherEdge = hueRangeNorm * featherAmount;
                    let innerEdge = hueRangeNorm - featherEdge;

                    if (hueDist <= innerEdge) {
                      hueMatch = 1.0;
                    } else {
                      hueMatch = 1.0 - smoothstep(innerEdge, hueRangeNorm, hueDist);
                    }
                  } else {
                    hueMatch = 1.0;
                  }
                }
              }

              // \u5F69\u5EA6\u3068\u660E\u5EA6\u306E\u6761\u4EF6\u30C1\u30A7\u30C3\u30AF
              // \u5F69\u5EA6\u7BC4\u56F2\u304C\u6700\u5927\uFF08min=0, max=1\uFF09\u306E\u5834\u5408\u306F\u5E38\u306B\u30DE\u30C3\u30C1
              let isFullSatRange = condition.saturationMin <= 0.01 && condition.saturationMax >= 0.99;
              var satMatch = 0.0;

              if (isFullSatRange) {
                satMatch = 1.0;
              } else if (hsv.y >= condition.saturationMin && hsv.y <= condition.saturationMax) {
                // \u30A8\u30C3\u30B8\u3092\u307C\u304B\u3059
                let satLowerDist = hsv.y - condition.saturationMin;
                let satUpperDist = condition.saturationMax - hsv.y;
                let satEdge = (condition.saturationMax - condition.saturationMin) * featherAmount * 0.5;

                if (satLowerDist >= satEdge && satUpperDist >= satEdge) {
                  satMatch = 1.0;
                } else {
                  satMatch = min(
                    smoothstep(0.0, satEdge, satLowerDist),
                    smoothstep(0.0, satEdge, satUpperDist)
                  );
                }
              }

              // \u660E\u5EA6\u7BC4\u56F2\u304C\u6700\u5927\uFF08min=0, max=1\uFF09\u306E\u5834\u5408\u306F\u5E38\u306B\u30DE\u30C3\u30C1
              let isFullBrightRange = condition.brightnessMin <= 0.01 && condition.brightnessMax >= 0.99;
              var brightMatch = 0.0;

              if (isFullBrightRange) {
                brightMatch = 1.0;
              } else if (hsv.z >= condition.brightnessMin && hsv.z <= condition.brightnessMax) {
                // \u30A8\u30C3\u30B8\u3092\u307C\u304B\u3059
                let brightLowerDist = hsv.z - condition.brightnessMin;
                let brightUpperDist = condition.brightnessMax - hsv.z;
                let brightEdge = (condition.brightnessMax - condition.brightnessMin) * featherAmount * 0.5;

                if (brightLowerDist >= brightEdge && brightUpperDist >= brightEdge) {
                  brightMatch = 1.0;
                } else {
                  brightMatch = min(
                    smoothstep(0.0, brightEdge, brightLowerDist),
                    smoothstep(0.0, brightEdge, brightUpperDist)
                  );
                }
              }

              // \u5168\u3066\u306E\u6761\u4EF6\u3092\u7D44\u307F\u5408\u308F\u305B\u308B
              return hueMatch * satMatch * brightMatch;
            }

            fn adjustColor(hsv: vec3f, condition: ColorCondition) -> vec3f {
              var adjustedHsv = hsv;

              // Shift hue
              adjustedHsv.x = fract(adjustedHsv.x + condition.hueShift / 360.0);

              // Saturation (Neutral at 1.0)
              if (condition.saturationScale < 1.0) {
                // 0-1 range: Decrease saturation
                adjustedHsv.y = adjustedHsv.y * condition.saturationScale;
              } else if (condition.saturationScale > 1.0) {
                // 1-2 range: Increase saturation
                let saturationIncrease = (condition.saturationScale - 1.0);
                adjustedHsv.y = adjustedHsv.y + (1.0 - adjustedHsv.y) * saturationIncrease;
              }

              // Brightness (Neutral at 1.0)
              if (condition.brightnessScale < 1.0) {
                adjustedHsv.z = adjustedHsv.z * condition.brightnessScale;
              } else if (condition.brightnessScale > 1.0) {
                let brightnessIncrease = (condition.brightnessScale - 1.0);
                adjustedHsv.z = adjustedHsv.z + (1.0 - adjustedHsv.z) * brightnessIncrease;
              }

              var rgb = hsv2rgb(adjustedHsv);

              if (condition.contrast != 1.0) {
                let mid = vec3f(0.5);
                rgb = mix(mid, rgb, condition.contrast);
              }

              return rgb;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let originalHsv = rgb2hsv(originalColor.rgb);

              var finalColor = originalColor.rgb;
              var matchFactor = calculateMatchFactor(originalHsv, params.condition, params.featherEdges);
              var maskColor = vec3f(0.0);

              if (matchFactor > 0.0) {
                let adjustedRgb = adjustColor(originalHsv, params.condition);

                if (params.blendMode == 0) { // Normal
                  finalColor = mix(originalColor.rgb, adjustedRgb, matchFactor);
                } else { // Multiply
                  var currentColor = originalColor.rgb;
                  currentColor = mix(currentColor, adjustedRgb, matchFactor * 0.5);

                  let secondHsv = rgb2hsv(currentColor);
                  let secondAdjusted = adjustColor(secondHsv, params.condition);
                  finalColor = mix(currentColor, secondAdjusted, matchFactor * 0.5);
                }

                maskColor = vec3f(matchFactor);
              }

              if (params.previewMask != 0) {
                textureStore(resultTexture, id.xy, vec4f(maskColor, originalColor.a));
              } else {
                let mixedColor = mixOklch(originalColor.rgb, finalColor, params.mix);
                textureStore(resultTexture, id.xy, vec4f(mixedColor, originalColor.a));
              }
            }

            // This is includes below 2 functions
            // fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32>;
            // fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32>;
            ${includeOklchMix()}
          `;
          const shader = device.createShaderModule({
            label: "Selective Color Correction Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions14(code);
          const pipeline = device.createComputePipeline({
            label: "Selective Color Correction Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Selective Color Correction V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Selective Color Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Selective Color Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Selective Color Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView14(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Selective Color Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const blendModeInt = params.blendMode === "multiply" ? 1 : 0;
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        blendMode: blendModeInt,
        featherEdges: params.featherEdges,
        previewMask: params.previewMask ? 1 : 0,
        mix: params.mix,
        condition: {
          ...params.useCondition ? params : defaultCondition,
          // JSの-1〜1の値をシェーダーで使う0〜2の値に変換
          hueShift: params.hueShift,
          saturationScale: params.saturationScale + 1,
          // -1〜1 → 0〜2
          brightnessScale: params.brightnessScale + 1,
          // -1〜1 → 0〜2
          contrast: params.contrast + 1,
          // -1〜1 → 0〜2
          _padding1: 0,
          _padding2: 0
        }
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Selective Color Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Selective Color Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/data-mosh.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions15,
  makeStructuredView as makeStructuredView15
} from "npm:webgpu-utils";
function calculatePaddingNeeded(params, dpiScale, width, height) {
  const intensityPadding = Math.ceil(
    params.intensity * 5 * params.blockSize * dpiScale
  );
  const shufflePadding = Math.ceil(
    params.pixelShuffle * Math.max(width, height) * 0.5 * dpiScale
  );
  const lineShiftPadding = Math.ceil(params.lineShift * width * 0.3 * dpiScale);
  const glitchPadding = Math.ceil(
    params.glitchFactor * Math.max(width, height) * 0.5 * dpiScale
  );
  const colorShiftPadding = Math.ceil(
    params.colorShift * Math.max(width, height) * 0.05 * dpiScale
  );
  return Math.max(
    intensityPadding,
    shufflePadding,
    lineShiftPadding,
    glitchPadding,
    colorShiftPadding
  );
}
var t15 = createTranslator({
  en: {
    title: "DataMosh Extreme",
    intensity: "Intensity",
    blockSize: "Block Size",
    direction: "Direction",
    horizontal: "Horizontal",
    vertical: "Vertical",
    both: "Both",
    seed: "Randomness Seed",
    colorShift: "Color Shift",
    glitchFactor: "Glitch Factor",
    pixelShuffle: "Pixel Shuffle",
    lineShift: "Line Shift",
    corruption: "Corruption",
    bitCorruption: "Bit Corruption",
    bitShift: "Bit Shift",
    headerGlitch: "Header Glitch"
  },
  ja: {
    title: "\u30C7\u30FC\u30BF\u30E2\u30C3\u30B7\u30E5\u6975\u9650",
    intensity: "\u5F37\u5EA6",
    blockSize: "\u30D6\u30ED\u30C3\u30AF\u30B5\u30A4\u30BA",
    direction: "\u65B9\u5411",
    horizontal: "\u6C34\u5E73",
    vertical: "\u5782\u76F4",
    both: "\u4E21\u65B9",
    seed: "\u30E9\u30F3\u30C0\u30E0\u30B7\u30FC\u30C9",
    colorShift: "\u8272\u305A\u308C",
    glitchFactor: "\u30B0\u30EA\u30C3\u30C1\u4FC2\u6570",
    pixelShuffle: "\u30D4\u30AF\u30BB\u30EB\u30B7\u30E3\u30C3\u30D5\u30EB",
    lineShift: "\u30E9\u30A4\u30F3\u79FB\u52D5",
    corruption: "\u7834\u640D\u52B9\u679C",
    bitCorruption: "\u30D3\u30C3\u30C8\u7834\u640D",
    bitShift: "\u30D3\u30C3\u30C8\u30B7\u30D5\u30C8",
    headerGlitch: "\u30D8\u30C3\u30C0\u30FC\u30B0\u30EA\u30C3\u30C1"
  }
});
var dataMosh = definePlugin({
  id: "datamosh-filter",
  title: t15("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 0.5
      },
      blockSize: {
        type: "int",
        default: 8
      },
      direction: {
        type: "string",
        enum: ["horizontal", "vertical", "both"],
        default: "both"
      },
      seed: {
        type: "int",
        default: 42
      },
      colorShift: {
        type: "real",
        default: 0.2
      },
      glitchFactor: {
        type: "real",
        default: 0.3
      },
      pixelShuffle: {
        type: "real",
        default: 0.2
      },
      lineShift: {
        type: "real",
        default: 0
      },
      corruption: {
        type: "real",
        default: 0
      },
      bitCorruption: {
        type: "real",
        default: 0
      },
      bitShift: {
        type: "int",
        default: 0
      },
      headerGlitch: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => {
      const intensity = Math.max(0, Math.min(2, params.intensity));
      const blockSize = Math.max(1, Math.min(64, params.blockSize));
      const seed = Math.max(0, Math.min(1e3, params.seed));
      const colorShift = Math.max(0, Math.min(2, params.colorShift));
      const glitchFactor = Math.max(0, Math.min(1, params.glitchFactor));
      const pixelShuffle = Math.max(0, Math.min(1, params.pixelShuffle));
      const lineShift = Math.max(0, Math.min(1, params.lineShift));
      const corruption = Math.max(0, Math.min(1, params.corruption));
      const bitCorruption = Math.max(0, Math.min(1, params.bitCorruption));
      const bitShift = Math.max(-7, Math.min(7, params.bitShift));
      const headerGlitch = Math.max(0, Math.min(1, params.headerGlitch));
      return {
        ...params,
        intensity,
        blockSize,
        seed,
        colorShift,
        glitchFactor,
        pixelShuffle,
        lineShift,
        corruption,
        bitCorruption,
        bitShift,
        headerGlitch
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        blockSize: Math.round(params.blockSize * scaleFactor)
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t22),
        blockSize: Math.round(lerp(paramsA.blockSize, paramsB.blockSize, t22)),
        direction: t22 < 0.5 ? paramsA.direction : paramsB.direction,
        seed: Math.round(lerp(paramsA.seed, paramsB.seed, t22)),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t22),
        glitchFactor: lerp(paramsA.glitchFactor, paramsB.glitchFactor, t22),
        pixelShuffle: lerp(paramsA.pixelShuffle, paramsB.pixelShuffle, t22),
        lineShift: lerp(paramsA.lineShift, paramsB.lineShift, t22),
        corruption: lerp(paramsA.corruption, paramsB.corruption, t22),
        bitCorruption: lerp(paramsA.bitCorruption, paramsB.bitCorruption, t22),
        bitShift: Math.round(lerp(paramsA.bitShift, paramsB.bitShift, t22)),
        headerGlitch: lerp(paramsA.headerGlitch, paramsB.headerGlitch, t22)
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "intensity", dataType: "float", min: 0, max: 2, value: params.intensity }),
            ui.numberInput({ key: "intensity", dataType: "float", value: params.intensity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("blockSize") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "blockSize", dataType: "int", min: 1, max: 64, value: params.blockSize }),
            ui.numberInput({ key: "blockSize", dataType: "int", value: params.blockSize })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("direction") }),
          ui.select({ key: "direction", value: params.direction, options: [
            { label: t15("horizontal"), value: "horizontal" },
            { label: t15("vertical"), value: "vertical" },
            { label: t15("both"), value: "both" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 2, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: "float", value: params.colorShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("glitchFactor") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "glitchFactor", dataType: "float", min: 0, max: 1, value: params.glitchFactor }),
            ui.numberInput({ key: "glitchFactor", dataType: "float", value: params.glitchFactor })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("pixelShuffle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "pixelShuffle", dataType: "float", min: 0, max: 1, value: params.pixelShuffle }),
            ui.numberInput({ key: "pixelShuffle", dataType: "float", value: params.pixelShuffle })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("lineShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "lineShift", dataType: "float", min: 0, max: 1, value: params.lineShift }),
            ui.numberInput({ key: "lineShift", dataType: "float", value: params.lineShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("corruption") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "corruption", dataType: "float", min: 0, max: 1, value: params.corruption }),
            ui.numberInput({ key: "corruption", dataType: "float", value: params.corruption })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("bitCorruption") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bitCorruption", dataType: "float", min: 0, max: 1, value: params.bitCorruption }),
            ui.numberInput({ key: "bitCorruption", dataType: "float", value: params.bitCorruption })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("bitShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bitShift", dataType: "int", min: -7, max: 7, value: params.bitShift }),
            ui.numberInput({ key: "bitShift", dataType: "int", value: params.bitShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("headerGlitch") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "headerGlitch", dataType: "float", min: 0, max: 1, value: params.headerGlitch }),
            ui.numberInput({ key: "headerGlitch", dataType: "float", value: params.headerGlitch })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t15("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: "int", min: 0, max: 1e3, value: params.seed }),
            ui.numberInput({ key: "seed", dataType: "int", value: params.seed })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(DataMosh Filter)" }
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: f32,
              baseDpi: f32,
              intensity: f32,
              blockSize: i32,
              directionMode: i32, // 0: horizontal, 1: vertical, 2: both
              seed: i32,
              colorShift: f32,
              glitchFactor: f32,
              pixelShuffle: f32,
              lineShift: f32,
              corruption: f32,
              bitCorruption: f32,
              bitShift: i32,
              headerGlitch: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn hash(value: u32) -> u32 {
              var state = value;
              state = state ^ 2747636419u;
              state = state * 2654435769u;
              state = state ^ (state >> 16u);
              state = state * 2654435769u;
              state = state ^ (state >> 16u);
              state = state * 2654435769u;
              return state;
            }

            fn random(seed: i32, pos: vec2u) -> f32 {
              let h = hash(pos.x + 1933u * pos.y + u32(seed) * 7919u);
              return f32(h) / 4294967295.0;
            }

            fn repeat(v: f32, length: f32) -> f32 {
                return v - floor(v / length) * length;
            }

            // Convert float (0-1) to byte (0-255)
            fn floatToByte(v: f32) -> u32 {
                return u32(clamp(v * 255.0, 0.0, 255.0));
            }

            // Convert byte (0-255) to float (0-1)
            fn byteToFloat(v: u32) -> f32 {
                return f32(v) / 255.0;
            }

            // Bit manipulation functions
            fn invertBits(value: u32) -> u32 {
                return ~value & 0xFFu; // Invert all bits but stay in 0-255 range
            }

            fn flipBit(value: u32, position: u32) -> u32 {
                let mask = 1u << position;
                return value ^ mask;
            }

            fn shiftBits(value: u32, shift: i32) -> u32 {
                if (shift > 0) {
                    return (value << u32(shift)) & 0xFFu;
                } else if (shift < 0) {
                    return (value >> u32(-shift)) & 0xFFu;
                }
                return value;
            }

            fn applyBitCorruption(value: u32, seed: i32, position: vec2u, bitCorruption: f32) -> u32 {
                var result = value;
                let rand = random(seed + 12345, position);

                // Randomly corrupt bits based on corruption level
                if (rand < bitCorruption * 0.3) {
                    // Complete bit inversion (all bits)
                    result = invertBits(result);
                } else if (rand < bitCorruption * 0.6) {
                    // Flip specific bits
                    let bitPos = u32(random(seed + 23456, position) * 8.0);
                    result = flipBit(result, bitPos);

                    // Flip a second bit with 50% chance
                    if (random(seed + 34567, position) < 0.5) {
                        let bitPos2 = u32(random(seed + 45678, position) * 8.0);
                        result = flipBit(result, bitPos2);
                    }
                }

                return result;
            }

            fn applyHeaderGlitch(color: vec4f, position: vec2u, headerGlitch: f32, seed: i32, dpiScale: f32) -> vec4f {
                var result = color;

                // Header glitch affects top portion of the image
                let dims = vec2f(textureDimensions(inputTexture));
                let normalizedY = f32(position.y) / dims.y;

                // Only apply to top 20% of the image with decreasing probability
                if (normalizedY < 0.2 && random(seed + 56789, position) < headerGlitch * (1.0 - normalizedY * 5.0)) {
                    let rand = random(seed + 67890, position);

                    if (rand < 0.3) {
                        // Replace with file format header-like patterns
                        if (random(seed + 78901, position) < 0.5) {
                            // Create patterns that look like corrupted headers
                            // High contrast patterns
                            let patternSize = max(1.0, dpiScale * 2.0); // Scale pattern size with DPI
                            let pattern = i32(f32(position.x) / patternSize + f32(position.y) / patternSize) % 6;

                            if (pattern == 0) {
                                result = vec4f(1.0, 0.0, 0.0, color.a); // Red
                            } else if (pattern == 1) {
                                result = vec4f(0.0, 0.0, 0.0, color.a); // Black
                            } else if (pattern == 2) {
                                result = vec4f(1.0, 1.0, 1.0, color.a); // White
                            } else if (pattern == 3) {
                                result = vec4f(0.0, 0.0, 1.0, color.a); // Blue
                            } else if (pattern == 4) {
                                result = vec4f(0.0, 1.0, 0.0, color.a); // Green
                            } else {
                                result = vec4f(1.0, 1.0, 0.0, color.a); // Yellow
                            }
                        } else {
                            // Checkerboard pattern - scaled with DPI
                            let checkerSize = max(2.0, 4.0 * dpiScale);
                            let checker = (i32(f32(position.x) / checkerSize) + i32(f32(position.y) / checkerSize)) % 2;
                            result = vec4f(f32(checker), f32(checker), f32(checker), color.a);
                        }
                    } else if (rand < 0.6) {
                        // Horizontal stripe pattern - scaled with DPI
                        let stripeHeight = max(2.0, 4.0 * dpiScale);
                        let stripe = i32(f32(position.y) / stripeHeight) % 4;
                        if (stripe == 0 || stripe == 2) {
                            result = vec4f(0.0, 0.0, 0.0, color.a);
                        } else {
                            result = vec4f(1.0, 1.0, 1.0, color.a);
                        }
                    } else {
                        // Complete color inversion
                        result = vec4f(1.0 - color.r, 1.0 - color.g, 1.0 - color.b, color.a);
                    }
                }

                return result;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));

                // Calculate DPI scaling factor
                let dpiScale = params.inputDpi / params.baseDpi;

                // Apply DPI scaling to blockSize
                let scaledBlockSize = f32(params.blockSize) * dpiScale;
                var blockSizeI = i32(scaledBlockSize);
                if (blockSizeI < 1) {
                    blockSizeI = 1; // Ensure minimum size of 1
                }

                // Block position
                let blockX = i32(id.x) / blockSizeI;
                let blockY = i32(id.y) / blockSizeI;

                // Generate several random values for different effects
                let rand = random(params.seed, vec2u(u32(blockX), u32(blockY)));
                let rand2 = random(params.seed + 1000, vec2u(u32(blockX), u32(blockY)));
                let rand3 = random(params.seed + 2000, vec2u(u32(blockX), u32(blockY)));
                let rand4 = random(params.seed + 3000, vec2u(u32(id.x), u32(id.y)));

                // Extreme block displacement with DPI scaling
                let scale = 5.0; // Larger displacement scale
                let displacementX = params.intensity * (rand - 0.5) * scale * scaledBlockSize;
                let displacementY = params.intensity * (rand2 - 0.5) * scale * scaledBlockSize;

                // Apply displacement based on direction mode
                var offsetX = 0.0;
                var offsetY = 0.0;

                if (params.directionMode == 0 || params.directionMode == 2) {
                    offsetX = displacementX;
                }

                if (params.directionMode == 1 || params.directionMode == 2) {
                    offsetY = displacementY;
                }

                // Pixel shuffle - completely random placement
                var shuffleX = 0.0;
                var shuffleY = 0.0;

                if (params.pixelShuffle > 0.0) {
                    if (rand3 < params.pixelShuffle) {
                        shuffleX = (random(params.seed + 4000, id.xy) - 0.5) * dims.x * 0.5 * dpiScale;
                        shuffleY = (random(params.seed + 5000, id.xy) - 0.5) * dims.y * 0.5 * dpiScale;
                    }
                }

                // Line shift effect (horizontal scanlines shift)
                var lineOffset = 0.0;
                if (params.lineShift > 0.0) {
                    let lineRand = random(params.seed + 6000, vec2u(0, id.y));
                    if (lineRand < params.lineShift * 0.5) {
                        // Every few lines gets a major shift
                        lineOffset = (lineRand * 2.0) * dims.x * 0.3 * dpiScale;
                    }
                }

                // Glitch blocks effect - some blocks get completely moved
                var glitchX = 0.0;
                var glitchY = 0.0;

                if (rand4 < params.glitchFactor * 0.3) {
                    // Major block displacement
                    let glitchRandX = random(params.seed + 7000, vec2u(u32(blockX), u32(blockY)));
                    let glitchRandY = random(params.seed + 8000, vec2u(u32(blockX), u32(blockY)));

                    glitchX = (glitchRandX - 0.5) * dims.x * 0.5 * dpiScale;
                    glitchY = (glitchRandY - 0.5) * dims.y * 0.3 * dpiScale;
                }

                // Final coordinate calculation with all effects combined
                let texCoordDisplaced = vec2f(
                    repeat((f32(id.x) + offsetX + shuffleX + lineOffset + glitchX) / dims.x, 1.0),
                    repeat((f32(id.y) + offsetY + shuffleY + glitchY) / dims.y, 1.0)
                );

                // Extreme color channel splitting with DPI scaling
                let colorShiftScale = params.colorShift * 0.3; // Stronger color shift

                let redShiftX = colorShiftScale * (rand - 0.5) * dims.x / 20.0 * dpiScale;
                let redShiftY = colorShiftScale * (rand3 - 0.5) * dims.y / 30.0 * dpiScale;

                let greenShiftX = colorShiftScale * (rand2 - 0.5) * dims.x / 25.0 * dpiScale;
                let greenShiftY = 0.0;

                let blueShiftX = colorShiftScale * (rand3 - 0.5) * dims.x / 15.0 * dpiScale;
                let blueShiftY = colorShiftScale * (rand - 0.5) * dims.y / 35.0 * dpiScale;

                let texCoordR = vec2f(
                    repeat(texCoordDisplaced.x + redShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + redShiftY / dims.y, 1.0)
                );

                let texCoordG = vec2f(
                    repeat(texCoordDisplaced.x + greenShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + greenShiftY / dims.y, 1.0)
                );

                let texCoordB = vec2f(
                    repeat(texCoordDisplaced.x + blueShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + blueShiftY / dims.y, 1.0)
                );

                // Sample colors with possible corruptions
                var colorR = textureSampleLevel(inputTexture, textureSampler, texCoordR, 0.0).r;
                var colorG = textureSampleLevel(inputTexture, textureSampler, texCoordG, 0.0).g;
                var colorB = textureSampleLevel(inputTexture, textureSampler, texCoordB, 0.0).b;
                var colorA = textureSampleLevel(inputTexture, textureSampler, texCoordDisplaced, 0.0).a;

                // Apply bit-level corruptions if enabled
                if (params.bitCorruption > 0.0) {
                    // Convert float colors (0-1) to byte values (0-255)
                    var byteR = floatToByte(colorR);
                    var byteG = floatToByte(colorG);
                    var byteB = floatToByte(colorB);

                    // Apply bit corruptions to each channel
                    byteR = applyBitCorruption(byteR, params.seed, id.xy, params.bitCorruption);
                    byteG = applyBitCorruption(byteG, params.seed + 1000, id.xy, params.bitCorruption);
                    byteB = applyBitCorruption(byteB, params.seed + 2000, id.xy, params.bitCorruption);

                    // Apply bit shifting if enabled
                    if (params.bitShift != 0) {
                        byteR = shiftBits(byteR, params.bitShift);
                        byteG = shiftBits(byteG, params.bitShift);
                        byteB = shiftBits(byteB, params.bitShift);
                    }

                    // Convert back to float colors (0-1)
                    colorR = byteToFloat(byteR);
                    colorG = byteToFloat(byteG);
                    colorB = byteToFloat(byteB);
                }

                // Corruption effect - some pixels get completely wrong values
                if (params.corruption > 0.0) {
                    // Bit corruption simulation
                    if (rand4 < params.corruption * 0.2) {
                        // Complete color inversion
                        colorR = 1.0 - colorR;
                        colorG = 1.0 - colorG;
                        colorB = 1.0 - colorB;
                    } else if (rand4 < params.corruption * 0.5) {
                        // Value corruption - replace with random values
                        let corruptionRand = random(params.seed + 9000, id.xy);

                        if (corruptionRand < 0.3) {
                            // Replace with random value
                            colorR = random(params.seed + 10000, id.xy);
                            colorG = random(params.seed + 11000, id.xy);
                            colorB = random(params.seed + 12000, id.xy);
                        } else if (corruptionRand < 0.6) {
                            // Channel swap
                            let temp = colorR;
                            colorR = colorB;
                            colorB = temp;
                        }
                    }
                }

                var finalColor = vec4f(colorR, colorG, colorB, colorA);

                // Apply header glitch effect
                if (params.headerGlitch > 0.0) {
                    finalColor = applyHeaderGlitch(finalColor, id.xy, params.headerGlitch, params.seed, dpiScale);
                }

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "DataMosh Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions15(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "DataMosh Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("DataMosh Filter", params);
      const dpiScale = dpi / baseDpi;
      const paddingNeeded = calculatePaddingNeeded(
        params,
        dpiScale,
        imgData.width,
        imgData.height
      );
      imgData = await paddingImageData(imgData, paddingNeeded);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformValues = makeStructuredView15(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      let directionMode = 2;
      if (params.direction === "horizontal") {
        directionMode = 0;
      } else if (params.direction === "vertical") {
        directionMode = 1;
      }
      uniformValues.set({
        inputDpi: parseFloat(dpi),
        baseDpi: parseFloat(baseDpi),
        intensity: params.intensity,
        blockSize: params.blockSize,
        directionMode,
        seed: params.seed,
        colorShift: params.colorShift,
        glitchFactor: params.glitchFactor,
        pixelShuffle: params.pixelShuffle,
        lineShift: params.lineShift,
        corruption: params.corruption,
        bitCorruption: params.bitCorruption,
        bitShift: params.bitShift,
        headerGlitch: params.headerGlitch
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "DataMosh Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/gaussian-blur.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions16,
  makeStructuredView as makeStructuredView16
} from "npm:webgpu-utils";
var t16 = createTranslator({
  en: {
    title: "Gaussian Blur",
    radius: "Blur Radius (px)",
    sigma: "Strength"
  },
  ja: {
    title: "\u30AC\u30A6\u30B9\u30D6\u30E9\u30FC",
    radius: "\u307C\u304B\u3057\u534A\u5F84 (px)",
    sigma: "\u5F37\u5EA6"
  }
});
var gaussianBlur = definePlugin({
  id: "gaussian-blur-v1",
  title: t16("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      radius: {
        type: "real",
        default: 10
      },
      sigma: {
        type: "real",
        default: 0.33
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        radius: lerp(paramsA.radius, paramsB.radius, t22),
        sigma: lerp(paramsA.sigma, paramsB.sigma, t22)
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t16("radius") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "radius", dataType: "float", min: 1, max: 200, value: params.radius }),
            ui.numberInput({ key: "radius", dataType: "float", value: params.radius })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t16("sigma") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "sigma", dataType: "float", min: 0, max: 1, value: params.sigma }),
            ui.numberInput({ key: "sigma", dataType: "float", value: params.sigma })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Gaussian Blur)" }
        },
        (device) => {
          const blurShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: f32,
              sigma: f32,
              direction: i32,  // 0: vertical, 1: horizontal
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn gaussianWeight(offset: f32, sigma: f32) -> f32 {
              let gaussianExp = -0.5 * (offset * offset) / (sigma * sigma);
              return exp(gaussianExp) / (2.5066282746 * sigma);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;
              let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * params.sigma;

              // Return original color if no blur is applied
              if (sigma <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let centerWeight = gaussianWeight(0.0, sigma);
              var totalWeightAlpha = centerWeight;
              var resultAlpha = originalColor.a * centerWeight;

              var totalWeightColor = centerWeight;
              var resultRGB = originalColor.rgb * centerWeight;

              var weightedColorSum = vec3f(0.0);
              var weightedColorWeight = 0.0;

              if (originalColor.a > 0.0) {
                weightedColorSum = originalColor.rgb * originalColor.a * centerWeight;
                weightedColorWeight = originalColor.a * centerWeight;
              }

              var pixelStep: f32;
              if (params.direction == 0) {
                pixelStep = 1.0 / dims.y;
              } else {
                pixelStep = 1.0 / dims.x;
              }

              for (var i = 0.1; i <= radiusScaled; i = i + 0.1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                var offsetPos: vec2f;
                var offsetNeg: vec2f;

                if (params.direction == 0) { // vertical
                  offsetPos = vec2f(0.0, pixelStep * offset);
                  offsetNeg = vec2f(0.0, -pixelStep * offset);
                } else { // horizontal
                  offsetPos = vec2f(pixelStep * offset, 0.0);
                  offsetNeg = vec2f(-pixelStep * offset, 0.0);
                }

                let posCoord = texCoord * toInputTexCoord + offsetPos;
                let negCoord = texCoord * toInputTexCoord + offsetNeg;

                let samplePos = textureSampleLevel(inputTexture, textureSampler, posCoord, 0.0);
                let sampleNeg = textureSampleLevel(inputTexture, textureSampler, negCoord, 0.0);

                resultAlpha += (samplePos.a + sampleNeg.a) * weight;
                totalWeightAlpha += weight * 2.0;

                resultRGB += (samplePos.rgb + sampleNeg.rgb) * weight;
                totalWeightColor += weight * 2.0;

                if (samplePos.a > 0.0) {
                  weightedColorSum += samplePos.rgb * samplePos.a * weight;
                  weightedColorWeight += samplePos.a * weight;
                }

                if (sampleNeg.a > 0.0) {
                  weightedColorSum += sampleNeg.rgb * sampleNeg.a * weight;
                  weightedColorWeight += sampleNeg.a * weight;
                }
              }

              resultAlpha = resultAlpha / totalWeightAlpha;

              var finalRGB: vec3f;

              if (weightedColorWeight > 0.0) {
                finalRGB = weightedColorSum / weightedColorWeight;
              } else {
                finalRGB = resultRGB / totalWeightColor;
              }

              let finalColor = vec4f(finalRGB, resultAlpha);
              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const blurShader = device.createShaderModule({
            label: "Gaussian Blur Shader",
            code: blurShaderCode
          });
          const blurPipelineDef = makeShaderDataDefinitions16(blurShaderCode);
          const blurPipeline = device.createComputePipeline({
            label: "Gaussian Blur Pipeline",
            layout: "auto",
            compute: {
              module: blurShader,
              entryPoint: "computeMain"
            }
          });
          return {
            device,
            blurPipeline,
            blurPipelineDef
          };
        }
      );
    },
    goLiveEffect: async ({ device, blurPipeline, blurPipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Gaussian Blur V1", params);
      const dpiRatio = dpi / baseDpi;
      const paddingSize = Math.ceil(params.radius);
      imgData = await paddingImageData(imgData, paddingSize * dpiRatio);
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const inputTexture = device.createTexture({
        label: "Gaussian Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const intermediateTexture = device.createTexture({
        label: "Gaussian Blur Intermediate Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Gaussian Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Gaussian Blur Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const verticalUniformValues = makeStructuredView16(
        blurPipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const horizontalUniformValues = makeStructuredView16(
        blurPipelineDef.uniforms.params
      );
      const horizontalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Horizontal Params Buffer",
        size: horizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      verticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        sigma: params.sigma,
        direction: 0
        // vertical
      });
      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        sigma: params.sigma,
        direction: 1
        // horizontal
      });
      device.queue.writeBuffer(
        verticalUniformBuffer,
        0,
        verticalUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        horizontalUniformBuffer,
        0,
        horizontalUniformValues.arrayBuffer
      );
      const verticalBindGroup = device.createBindGroup({
        label: "Gaussian Blur Vertical Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: verticalUniformBuffer }
          }
        ]
      });
      const horizontalBindGroup = device.createBindGroup({
        label: "Gaussian Blur Horizontal Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: intermediateTexture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: horizontalUniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Gaussian Blur Command Encoder"
      });
      const verticalPass = commandEncoder.beginComputePass({
        label: "Gaussian Blur Vertical Pass"
      });
      verticalPass.setPipeline(blurPipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      verticalPass.end();
      const horizontalPass = commandEncoder.beginComputePass({
        label: "Gaussian Blur Horizontal Pass"
      });
      horizontalPass.setPipeline(blurPipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      horizontalPass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/blush-stroke.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions17,
  makeStructuredView as makeStructuredView17
} from "npm:webgpu-utils";
var t17 = createTranslator({
  en: {
    title: "Brush Stroke V1",
    angle: "Angle",
    brushSize: "Brush Size",
    strokeLength: "Stroke Length",
    randomStrength: "Random Strength",
    randomSeed: "Random Seed",
    strokeDensity: "Stroke Density",
    blendWithOriginal: "Blend with Original"
  },
  ja: {
    title: "\u30D6\u30E9\u30B7\u30B9\u30C8\u30ED\u30FC\u30AF V1",
    angle: "\u89D2\u5EA6",
    brushSize: "\u30D6\u30E9\u30B7\u30B5\u30A4\u30BA",
    strokeLength: "\u30B9\u30C8\u30ED\u30FC\u30AF\u9577",
    randomStrength: "\u30E9\u30F3\u30C0\u30E0\u306B\u63CF\u753B",
    randomSeed: "\u30E9\u30F3\u30C0\u30E0\u30B7\u30FC\u30C9",
    strokeDensity: "\u63CF\u753B\u306E\u6FC3\u5EA6",
    blendWithOriginal: "\u5143\u753B\u50CF\u3068\u30D6\u30EC\u30F3\u30C9"
  }
});
var brushStroke = definePlugin({
  id: "brush-stroke-v1",
  title: t17("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      angle: {
        type: "real",
        default: 45
      },
      brushSize: {
        // px
        type: "real",
        default: 10
      },
      strokeLength: {
        // px
        type: "real",
        default: 25
      },
      strokeDensity: {
        type: "real",
        default: 1
      },
      randomStrength: {
        type: "real",
        default: 0.5
      },
      randomSeed: {
        type: "int",
        default: 12345
      },
      blendWithOriginal: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        brushSize: params.brushSize * scaleFactor,
        strokeLength: params.strokeLength * scaleFactor,
        strokeDensity: params.strokeDensity * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        angle: lerp(paramsA.angle, paramsB.angle, t22),
        brushSize: lerp(paramsA.brushSize, paramsB.brushSize, t22),
        strokeLength: lerp(paramsA.strokeLength, paramsB.strokeLength, t22),
        randomStrength: lerp(paramsA.randomStrength, paramsB.randomStrength, t22),
        randomSeed: Math.round(lerp(paramsA.randomSeed, paramsB.randomSeed, t22)),
        strokeDensity: lerp(paramsA.strokeDensity, paramsB.strokeDensity, t22),
        blendWithOriginal: lerp(
          paramsA.blendWithOriginal,
          paramsB.blendWithOriginal,
          t22
        )
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "angle",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.angle
            }),
            ui.numberInput({
              key: "angle",
              dataType: "float",
              value: params.angle
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("brushSize") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brushSize",
              dataType: "float",
              min: 0.5,
              max: 20,
              value: params.brushSize
            }),
            ui.numberInput({
              key: "brushSize",
              dataType: "float",
              value: params.brushSize
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("strokeLength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strokeLength",
              dataType: "float",
              min: 1,
              max: 200,
              value: params.strokeLength
            }),
            ui.numberInput({
              key: "strokeLength",
              dataType: "float",
              value: params.strokeLength
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("strokeDensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strokeDensity",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.strokeDensity
            }),
            ui.numberInput({
              key: "strokeDensity",
              dataType: "float",
              min: 0,
              max: 2,
              step: 0.1,
              value: params.strokeDensity
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("randomStrength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "randomStrength",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.randomStrength
            }),
            ui.numberInput({
              key: "randomStrength",
              dataType: "float",
              min: 0,
              max: 1,
              step: 0.01,
              value: params.randomStrength
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "randomSeed",
              dataType: "int",
              min: 1,
              max: 99999,
              value: params.randomSeed
            }),
            ui.numberInput({
              key: "randomSeed",
              dataType: "int",
              value: params.randomSeed
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t17("blendWithOriginal") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blendWithOriginal",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.blendWithOriginal
            }),
            ui.numberInput({
              key: "blendWithOriginal",
              dataType: "float",
              min: 0,
              max: 100,
              step: 1,
              value: params.blendWithOriginal
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Brush Stroke Effect)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              angle: f32,
              brushSize: f32,
              strokeLength: f32,
              randomStrength: f32,
              randomSeed: i32,
              strokeDensity: f32,
              blendWithOriginal: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(params.outputSize);
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // \u5143\u306E\u753B\u50CF\u306E\u8272\u3092\u53D6\u5F97 (\u975E\u30D7\u30EA\u30DE\u30EB\u30C1\u30D7\u30E9\u30A4\u30C9\u30A2\u30EB\u30D5\u30A1\u3068\u3057\u3066\u6271\u3046)
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // \u6700\u7D42\u7684\u306A\u8272\uFF08\u521D\u671F\u5024\u306F\u5143\u753B\u50CF\uFF09
              var finalColor = originalColor;

              // \u30E9\u30F3\u30C0\u30E0\u30B7\u30FC\u30C9\u306E\u8A2D\u5B9A
              let seed = f32(params.randomSeed);

              // \u89D2\u5EA6\u3092\u30E9\u30B8\u30A2\u30F3\u306B\u5909\u63DB
              let baseAngleRad = params.angle * 3.14159265359 / 180.0;

              // \u7269\u7406\u7684\u306A\u5BF8\u6CD5\u306B\u57FA\u3065\u304F\u8A08\u7B97\uFF08DPI-aware)
              let onTex1PxFactor = 1.0 / params.dpiScale; // \u7269\u7406\u30B9\u30B1\u30FC\u30EB\u4FC2\u6570

              // \u30B0\u30EA\u30C3\u30C9\u69CB\u9020
              let physicalBrushSize = params.brushSize; // \u3059\u3067\u306B\u7269\u7406\u5358\u4F4D
              let physicalCellSize = sqrt(physicalBrushSize) * 5.0; // \u30D9\u30FC\u30B9\u30B5\u30A4\u30BA

              // \u6A2A\u65B9\u5411\u3068\u7E26\u65B9\u5411\u3067\u7570\u306A\u308B\u5BC6\u5EA6\u3092\u9069\u7528
              let baseDensity = 1.0 / (physicalCellSize * params.dpiScale);
              // \u6A2A\u65B9\u5411\u306E\u5BC6\u5EA6\u306F\u30D9\u30FC\u30B9\u5BC6\u5EA6
              let densityX = baseDensity;
              // \u7E26\u65B9\u5411\u306E\u5BC6\u5EA6\u306FstrokeDensity\u306B\u3088\u3063\u3066\u7279\u306B\u5F71\u97FF\u3092\u53D7\u3051\u308B
              let densityY = baseDensity * params.strokeDensity * 1.5;

              // \u7570\u306A\u308B\u5BC6\u5EA6\u3067\u30B0\u30EA\u30C3\u30C9\u5EA7\u6A19\u3092\u8A08\u7B97
              let gridCoordX = floor(texCoord.x * dims.x * densityX);
              let gridCoordY = floor(texCoord.y * dims.y * densityY);
              let gridCoord = vec2f(gridCoordX, gridCoordY);

              // \u3053\u306E\u30D4\u30AF\u30BB\u30EB\u304C\u542B\u307E\u308C\u308B\u30BB\u30EB\u3068\u305D\u306E\u5468\u8FBA\u30BB\u30EB\u3092\u30EB\u30FC\u30D7
              // \u4E0B\u304B\u3089\u4E0A\u3078\u30B9\u30AD\u30E3\u30F3 (dy=-1\u304B\u30891) \u3059\u308B\u3053\u3068\u3067\u3001\u4E0A\u90E8\u306E\u30B9\u30C8\u30ED\u30FC\u30AF\u304C\u4E0B\u90E8\u306E\u30B9\u30C8\u30ED\u30FC\u30AF\u3092\u4E0A\u66F8\u304D\u3059\u308B
              for (var dy = -1; dy <= 1; dy++) {
                for (var dx = -1; dx <= 1; dx++) {
                  let cellPos = gridCoord + vec2f(f32(dx), f32(dy));

                  // \u30B9\u30C8\u30ED\u30FC\u30AF1\u3064\u3042\u305F\u308A\u306E\u57FA\u672C\u7684\u306A\u30E9\u30F3\u30C0\u30E0\u5024
                  let cellHash = fract(sin(dot(cellPos, vec2f(12.9898, 78.233)) + seed * 0.01) * 43758.5453);

                  // \u3053\u306E\u30BB\u30EB\u3092\u63CF\u753B\u3059\u308B\u304B\u3069\u3046\u304B\u306E\u30E9\u30F3\u30C0\u30E0\u5224\u5B9A\uFF08\u5BC6\u5EA6\u8ABF\u6574\uFF09
                  // \u30D6\u30E9\u30B7\u30B5\u30A4\u30BA\u304C\u5927\u304D\u3044\u307B\u3069\u3001\u3088\u308A\u591A\u304F\u306E\u30BB\u30EB\u3092\u63CF\u753B - \u7269\u7406\u5358\u4F4D\u3067\u4E00\u5B9A
                  // strokeDensity\u3082\u6A2A\u65B9\u5411\u306E\u5BC6\u5EA6\u306B\u5F71\u97FF
                  let cellDrawProb = min(0.95, 0.7 + physicalBrushSize * 0.015) * params.strokeDensity;
                  if (cellHash < cellDrawProb) {

                    // \u30BB\u30EB\u3054\u3068\u306B\u500B\u5225\u306E\u89D2\u5EA6\u5909\u52D5
                    let angleJitter = (cellHash * 2.0 - 1.0) * 0.6;
                    let strokeAngle = baseAngleRad + (angleJitter * params.randomStrength);
                    let strokeDir = vec2f(cos(strokeAngle), sin(strokeAngle));

                    let densityVec = vec2f(densityX, densityY);
                    let cellCenter = (cellPos + vec2f(0.5)) / (dims * densityVec);

                    // \u30B9\u30C8\u30ED\u30FC\u30AF\u306E\u9577\u3055 - \u7269\u7406\u5358\u4F4D\u3067\u4E00\u5B9A
                    let physicalStrokeLength = params.strokeLength;
                    let pixelStrokeLength = physicalStrokeLength * params.dpiScale;
                    let strokeLen = (pixelStrokeLength * 0.3) / dims.x;

                    // \u30B9\u30C8\u30ED\u30FC\u30AF\u306F\u8907\u6570\u306E\u30BB\u30B0\u30E1\u30F3\u30C8\u3067\u306F\u306A\u304F\u3001\u72EC\u7ACB\u3057\u305F\u77ED\u3044\u7DDA\u5206\u3068\u3057\u3066
                    let halfLen = strokeLen * 0.5;
                    let strokeStart = cellCenter - strokeDir * halfLen;
                    let strokeEnd = cellCenter + strokeDir * halfLen;

                    // \u73FE\u5728\u306E\u30D4\u30AF\u30BB\u30EB\u304B\u3089\u30B9\u30C8\u30ED\u30FC\u30AF\u307E\u3067\u306E\u8DDD\u96E2\u8A08\u7B97
                    // \u7DDA\u5206\u3078\u306E\u6700\u77ED\u8DDD\u96E2\u3092\u8A08\u7B97
                    let toPixel = texCoord - strokeStart;
                    let projLen = dot(toPixel, strokeDir);
                    let paramT = clamp(projLen / (strokeLen), 0.0, 1.0);

                    // \u30B9\u30C8\u30ED\u30FC\u30AF\u4E0A\u306E\u6700\u8FD1\u70B9
                    let closestPt = strokeStart + strokeDir * paramT * strokeLen;

                    // \u30D4\u30AF\u30BB\u30EB\u304B\u3089\u30B9\u30C8\u30ED\u30FC\u30AF\u3078\u306E\u8DDD\u96E2\uFF08\u7DDA\u5206\u304B\u3089\u306E\u8DDD\u96E2\uFF09- \u7269\u7406\u5358\u4F4D\u3067\u8A08\u7B97
                    let distToLine = distance(texCoord, closestPt) * dims.x * onTex1PxFactor;

                    // \u7DDA\u7AEF\u306E\u4E38\u3081\u51E6\u7406\u306B\u4F7F\u7528\u3059\u308B\u7AEF\u70B9\u304B\u3089\u306E\u8DDD\u96E2
                    let distToEnds = min(
                      distance(texCoord, strokeStart),
                      distance(texCoord, strokeEnd)
                    ) * dims.x * onTex1PxFactor;

                    // \u7AEF\u3092\u4E38\u304F\u3059\u308B\u8DDD\u96E2\u5834
                    let brushWidth = physicalBrushSize * 0.4; // \u7269\u7406\u5358\u4F4D\u3067\u306E\u30D6\u30E9\u30B7\u5E45

                    // \u7DDA\u5206\u4E0A\u306E\u5834\u5408\u306F\u7DDA\u304B\u3089\u306E\u8DDD\u96E2\u3001\u7AEF\u70B9\u8FD1\u304F\u3067\u306F\u7AEF\u70B9\u304B\u3089\u306E\u8DDD\u96E2\u3092\u4F7F\u7528
                    let endCapT = 0.1; // \u7AEF\u70B9\u306E\u5F71\u97FF\u7BC4\u56F2\uFF080\uFF5E1\uFF09
                    let endCapBlend = step(endCapT, paramT) * step(endCapT, 1.0 - paramT);

                    // \u7DDA\u5206\u307E\u305F\u306F\u7AEF\u70B9\u304B\u3089\u306E\u8DDD\u96E2\uFF08\u4E38\u3044\u7AEF\u90E8\u3092\u4F5C\u6210\uFF09
                    let finalDist = mix(distToEnds, distToLine, endCapBlend);

                    // \u30D6\u30E9\u30B7\u306E\u5F62\u72B6\uFF08\u91CD\u307F\u4ED8\u3051\uFF09
                    let weight = 1.0 - step(brushWidth, finalDist);

                    // \u30B9\u30C8\u30ED\u30FC\u30AF\u306E\u8272\u3092\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\uFF08\u4E2D\u5FC3\u70B9\u304B\u3089\uFF09- \u30B9\u30C8\u30EC\u30FC\u30C8\u30A2\u30EB\u30D5\u30A1\u3068\u3057\u3066\u6271\u3046
                    let samplePos = cellCenter;
                    let sampledColor = textureSampleLevel(inputTexture, textureSampler, samplePos * toInputTexCoord, 0.0);

                    // \u660E\u793A\u7684\u306B\u30B9\u30C8\u30EC\u30FC\u30C8\u30A2\u30EB\u30D5\u30A1\u3068\u3057\u3066\u51E6\u7406
                    var strokeColor = sampledColor;

                    // \u8272\u306E\u5FAE\u8ABF\u6574\uFF08\u975E\u5E38\u306B\u63A7\u3048\u3081\u306B\uFF09
                    let colorShift = (fract(cellHash * 456.789) - 0.5) * 0.05;
                    strokeColor = vec4f(
                      clamp(strokeColor.r + colorShift, 0.0, 1.0),
                      clamp(strokeColor.g + colorShift, 0.0, 1.0),
                      clamp(strokeColor.b + colorShift, 0.0, 1.0),
                      strokeColor.a
                    );

                    // \u91CD\u307F\u306B\u57FA\u3065\u3044\u3066\u6700\u7D42\u8272\u306B\u30D6\u30EC\u30F3\u30C9
                    if (weight > 0.01 && strokeColor.a > 0.001) {
                      let opacity = weight * strokeColor.a; // \u5143\u306E\u900F\u660E\u5EA6\u3092\u4FDD\u6301
                      // \u4E0D\u900F\u660E\u5EA6\u3092\u7D2F\u7A4D\u7684\u306B\u8A08\u7B97\uFF08\u4EE5\u524D\u306E\u7D50\u679C\u3092\u8003\u616E\uFF09
                      let newAlpha = opacity + finalColor.a * (1.0 - opacity);

                      if (newAlpha > 0.001) {
                        // \u8272\u3092\u9069\u5207\u306B\u30D6\u30EC\u30F3\u30C9\uFF08\u30A2\u30EB\u30D5\u30A1\u3092\u8003\u616E\uFF09
                        let blendedRGB = (strokeColor.rgb * opacity + finalColor.rgb * finalColor.a * (1.0 - opacity)) / newAlpha;
                        finalColor = vec4f(blendedRGB, newAlpha);
                      }
                    }
                  }
                }
              }

              // \u6700\u7D42\u7684\u306A\u30B9\u30C8\u30ED\u30FC\u30AF\u52B9\u679C\u3092\u5143\u753B\u50CF\u3068\u30D6\u30EC\u30F3\u30C9\uFF08Oklch\u30AB\u30E9\u30FC\u30B9\u30DA\u30FC\u30B9\u3067\uFF09
              let blendFactor = params.blendWithOriginal / 100.0;

              // \u30D6\u30EC\u30F3\u30C9\u304C0\u3088\u308A\u5927\u304D\u3044\u5834\u5408\u306E\u307F\u30D6\u30EC\u30F3\u30C9\u51E6\u7406\u3092\u884C\u3046
              if (blendFactor > 0.001) {
                // \u30A2\u30EB\u30D5\u30A1\u5024\u3092\u500B\u5225\u306B\u8A08\u7B97
                let targetAlpha = mix(finalColor.a, originalColor.a, blendFactor);

                if (targetAlpha > 0.001) {
                  // \u5B8C\u5168\u900F\u660E\u3067\u306A\u3044\u5834\u5408\u306E\u307FOklch\u30D6\u30EC\u30F3\u30C9\u3092\u9069\u7528
                  let colorA = vec4f(finalColor.rgb, 1.0);   // \u4E00\u6642\u7684\u306B\u30A2\u30EB\u30D5\u30A1\u30921\u306B\u3057\u3066\u8272\u306E\u307F\u3092\u30D6\u30EC\u30F3\u30C9
                  let colorB = vec4f(originalColor.rgb, 1.0);

                  // Oklch\u3067\u30AB\u30E9\u30FC\u30D6\u30EC\u30F3\u30C9
                  let blendedColor = mixOklchVec4(colorA, colorB, blendFactor);
                  finalColor = vec4f(blendedColor.rgb, targetAlpha);
                } else {
                  // \u5B8C\u5168\u900F\u660E\u306E\u5834\u5408
                  finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
                }
              }

              // \u30D6\u30EC\u30F3\u30C9\u3057\u306A\u3044\u5834\u5408\u3084\u3001\u6700\u7D42\u7D50\u679C\u304C\u5143\u306E\u52B9\u679C\u3068\u540C\u3058\u5834\u5408\u306F\u3001\u7D50\u679C\u304C\u306A\u3044\u3068\u304D\u306B\u5143\u753B\u50CF\u3092\u4F7F\u7528
              if (finalColor.a < 0.001) {
                // \u30B9\u30C8\u30ED\u30FC\u30AF\u52B9\u679C\u304C\u307B\u3068\u3093\u3069\u306A\u304F\u3001\u5143\u753B\u50CF\u3068\u306E\u30D6\u30EC\u30F3\u30C9\u3082\u5C11\u306A\u3044\u5834\u5408
                if (blendFactor > 0.9) {
                  // \u307B\u307C\u5B8C\u5168\u306B\u5143\u753B\u50CF\u3092\u8868\u793A
                  finalColor = originalColor;
                }
              }

              textureStore(resultTexture, id.xy, finalColor);
            }

            // Drop-in replacement for mix() that works with vec3f rgb colors
            fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32> {
              // RGB -> Linear RGB
              let linearColor1 = vec3<f32>(
                select(color1.r / 12.92, pow((color1.r + 0.055) / 1.055, 2.4), color1.r <= 0.04045),
                select(color1.g / 12.92, pow((color1.g + 0.055) / 1.055, 2.4), color1.g <= 0.04045),
                select(color1.b / 12.92, pow((color1.b + 0.055) / 1.055, 2.4), color1.b <= 0.04045),
              );

              let linearColor2 = vec3<f32>(
                select(color2.r / 12.92, pow((color2.r + 0.055) / 1.055, 2.4), color2.r <= 0.04045),
                select(color2.g / 12.92, pow((color2.g + 0.055) / 1.055, 2.4), color2.g <= 0.04045),
                select(color2.b / 12.92, pow((color2.b + 0.055) / 1.055, 2.4), color2.b <= 0.04045),
              );

              // Linear RGB -> LMS
              let lms1 = mat3x3<f32>(
                0.4122214708, 0.5363325363, 0.0514459929,
                0.2119034982, 0.6806995451, 0.1073969566,
                0.0883024619, 0.2817188376, 0.6299787005
              ) * linearColor1;

              let lms2 = mat3x3<f32>(
                0.4122214708, 0.5363325363, 0.0514459929,
                0.2119034982, 0.6806995451, 0.1073969566,
                0.0883024619, 0.2817188376, 0.6299787005
              ) * linearColor2;

              // LMS -> Oklab
              let lms1_pow = vec3<f32>(pow(lms1.x, 1.0/3.0), pow(lms1.y, 1.0/3.0), pow(lms1.z, 1.0/3.0));
              let lms2_pow = vec3<f32>(pow(lms2.x, 1.0/3.0), pow(lms2.y, 1.0/3.0), pow(lms2.z, 1.0/3.0));

              let oklabMatrix = mat3x3<f32>(
                0.2104542553, 0.7936177850, -0.0040720468,
                1.9779984951, -2.4285922050, 0.4505937099,
                0.0259040371, 0.7827717662, -0.8086757660
              );

              let oklab1 = oklabMatrix * lms1_pow;
              let oklab2 = oklabMatrix * lms2_pow;

              // Oklab -> OKLCH
              let L1 = oklab1.x;
              let L2 = oklab2.x;
              let C1 = sqrt(oklab1.y * oklab1.y + oklab1.z * oklab1.z);
              let C2 = sqrt(oklab2.y * oklab2.y + oklab2.z * oklab2.z);
              let H1 = atan2(oklab1.z, oklab1.y);
              let H2 = atan2(oklab2.z, oklab2.y);

              // \u8272\u76F8\u306E\u88DC\u9593\uFF08\u6700\u77ED\u7D4C\u8DEF\uFF09
              let hDiff = H2 - H1;
              let hDiffAdjusted = select(
                hDiff,
                hDiff - 2.0 * 3.14159265359,
                hDiff > 3.14159265359
              );
              let hDiffFinal = select(
                hDiffAdjusted,
                hDiffAdjusted + 2.0 * 3.14159265359,
                hDiffAdjusted < -3.14159265359
              );

              let L = mix(L1, L2, t);
              let C = mix(C1, C2, t);
              let H = H1 + t * hDiffFinal;

              // OKLCH -> Oklab
              let a = C * cos(H);
              let b = C * sin(H);

              // Oklab -> LMS
              let oklabInverseMatrix = mat3x3<f32>(
                1.0, 0.3963377774, 0.2158037573,
                1.0, -0.1055613458, -0.0638541728,
                1.0, -0.0894841775, -1.2914855480
              );

              let lms_pow = oklabInverseMatrix * vec3<f32>(L, a, b);
              let lms = vec3<f32>(
                pow(lms_pow.x, 3.0),
                pow(lms_pow.y, 3.0),
                pow(lms_pow.z, 3.0)
              );

              // LMS -> Linear RGB
              let lmsToRgbMatrix = mat3x3<f32>(
                4.0767416621, -3.3077115913, 0.2309699292,
                -1.2684380046, 2.6097574011, -0.3413193965,
                -0.0041960863, -0.7034186147, 1.7076147010
              );

              let linearRgb = lmsToRgbMatrix * lms;

              // Linear RGB -> RGB
              let rgbResult = vec3<f32>(
                select(12.92 * linearRgb.r, 1.055 * pow(linearRgb.r, 1.0/2.4) - 0.055, linearRgb.r <= 0.0031308),
                select(12.92 * linearRgb.g, 1.055 * pow(linearRgb.g, 1.0/2.4) - 0.055, linearRgb.g <= 0.0031308),
                select(12.92 * linearRgb.b, 1.055 * pow(linearRgb.b, 1.0/2.4) - 0.055, linearRgb.b <= 0.0031308),
              );

              return clamp(rgbResult, vec3<f32>(0.0), vec3<f32>(1.0));
            }

            fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
              return vec4<f32>(
                mixOklch(color1.rgb, color2.rgb, t),
                mix(color1.a, color2.a, t)
              );
            }
          `;
          const shader = device.createShaderModule({
            label: "Brush Stroke Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions17(code);
          console.log({ shader });
          const pipeline = device.createComputePipeline({
            label: "Brush Stroke Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Brush Stroke Effect", params);
      const dpiScale = dpi / baseDpi;
      imgData = await paddingImageData(
        imgData,
        Math.ceil(params.strokeLength / 3 * dpiScale)
      );
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Brush Stroke Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Brush Stroke Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Brush Stroke Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformValues = makeStructuredView17(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Brush Stroke Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        angle: params.angle,
        brushSize: params.brushSize,
        strokeLength: params.strokeLength,
        randomStrength: params.randomStrength,
        randomSeed: params.randomSeed,
        strokeDensity: params.strokeDensity,
        blendWithOriginal: params.blendWithOriginal
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Brush Stroke Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Brush Stroke Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/paper-texture.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions18,
  makeStructuredView as makeStructuredView18
} from "npm:webgpu-utils";
var t18 = createTranslator({
  en: {
    title: "Paper Texture Generator Pro",
    paperType: "Paper Type",
    beatingDegree: "Beating Degree",
    fiberAmount: "Fiber Amount",
    fiberDarkness: "Fiber Darkness",
    seed: "Seed",
    reset: "Reset",
    lightingEffect: "Lighting Effect",
    lightDirection: "Light Direction",
    lightIntensity: "Light Intensity",
    depthEffect: "Depth Effect",
    surfaceRoughness: "Surface Roughness"
  },
  ja: {
    title: "\u7D19\u30C6\u30AF\u30B9\u30C1\u30E3\u751F\u6210 Pro",
    paperType: "\u7D19\u306E\u7A2E\u985E",
    beatingDegree: "\u53E9\u89E3\u5EA6",
    fiberAmount: "\u7E4A\u7DAD\u306E\u91CF",
    fiberDarkness: "\u7E4A\u7DAD\u306E\u6FC3\u3055",
    seed: "\u30B7\u30FC\u30C9\u5024",
    reset: "\u30EA\u30BB\u30C3\u30C8",
    lightingEffect: "\u5149\u6E90\u52B9\u679C",
    lightDirection: "\u5149\u306E\u65B9\u5411",
    lightIntensity: "\u5149\u306E\u5F37\u3055",
    depthEffect: "\u51F9\u51F8\u52B9\u679C",
    surfaceRoughness: "\u8868\u9762\u306E\u7C97\u3055"
  }
});
var defaultValues = {
  paperType: "woodfree",
  beatingDegree: 0.7,
  fiberAmount: 1,
  fiberDarkness: 0.2,
  seed: Math.floor(Math.random() * 1e5),
  lightingEnabled: true,
  lightIntensity: 0.5,
  lightAngle: 45,
  depthEffect: 0.5,
  surfaceRoughness: 0.3
};
var paperTexture = definePlugin({
  id: "paper-texture-generator-v1",
  title: t18("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      paperType: {
        type: "string",
        enum: [
          "woodfree",
          "art",
          "coated",
          "machine",
          "lightCoated",
          "kouzo",
          "mitsumata",
          "ganpi",
          "tengujou",
          "tousagami"
        ],
        default: defaultValues.paperType
      },
      beatingDegree: {
        type: "real",
        default: defaultValues.beatingDegree
      },
      fiberAmount: {
        type: "real",
        default: defaultValues.fiberAmount
      },
      fiberDarkness: {
        type: "real",
        default: defaultValues.fiberDarkness
      },
      seed: {
        type: "int",
        default: Math.floor(Math.random() * 1e5)
      },
      lightingEnabled: {
        type: "bool",
        default: defaultValues.lightingEnabled
      },
      lightIntensity: {
        type: "real",
        default: defaultValues.lightIntensity
      },
      lightAngle: {
        type: "real",
        default: defaultValues.lightAngle
      },
      depthEffect: {
        type: "real",
        default: defaultValues.depthEffect
      },
      surfaceRoughness: {
        type: "real",
        default: defaultValues.surfaceRoughness
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        fiberAmount: params.fiberAmount * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        paperType: t22 < 0.5 ? paramsA.paperType : paramsB.paperType,
        beatingDegree: lerp(paramsA.beatingDegree, paramsB.beatingDegree, t22),
        fiberAmount: lerp(paramsA.fiberAmount, paramsB.fiberAmount, t22),
        fiberDarkness: lerp(paramsA.fiberDarkness, paramsB.fiberDarkness, t22),
        seed: Math.round(lerp(paramsA.seed, paramsB.seed, t22)),
        lightingEnabled: t22 < 0.5 ? paramsA.lightingEnabled : paramsB.lightingEnabled,
        lightIntensity: lerp(paramsA.lightIntensity, paramsB.lightIntensity, t22),
        lightAngle: lerp(paramsA.lightAngle, paramsB.lightAngle, t22),
        depthEffect: lerp(paramsA.depthEffect, paramsB.depthEffect, t22),
        surfaceRoughness: lerp(
          paramsA.surfaceRoughness,
          paramsB.surfaceRoughness,
          t22
        )
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("paperType") }),
          ui.select({
            key: "paperType",
            value: params.paperType,
            options: Object.entries(paperTypes).map(([key, value]) => ({
              label: value.type,
              value: key
            }))
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("beatingDegree") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "beatingDegree",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.beatingDegree
            }),
            ui.numberInput({
              key: "beatingDegree",
              dataType: "float",
              value: params.beatingDegree
            }),
            ui.button({
              text: t18("reset"),
              onClick: () => setParam({
                beatingDegree: defaultValues.beatingDegree
              })
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("fiberAmount") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fiberAmount",
              dataType: "float",
              min: 0.1,
              max: 10,
              value: params.fiberAmount
            }),
            ui.numberInput({
              key: "fiberAmount",
              dataType: "float",
              value: params.fiberAmount
            }),
            ui.button({
              text: t18("reset"),
              onClick: () => setParam({ fiberAmount: defaultValues.fiberAmount })
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("fiberDarkness") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fiberDarkness",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.fiberDarkness
            }),
            ui.numberInput({
              key: "fiberDarkness",
              dataType: "float",
              value: params.fiberDarkness
            }),
            ui.button({
              text: t18("reset"),
              onClick: () => setParam({ fiberDarkness: defaultValues.fiberDarkness })
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("seed") }),
          ui.group({ direction: "row" }, [
            ui.numberInput({
              key: "seed",
              dataType: "int",
              value: params.seed
            }),
            ui.button({
              text: t18("reset"),
              onClick: () => setParam({ seed: Math.floor(Math.random() * 1e5) })
            })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t18("lightingEffect") }),
          ui.select({
            key: "lightingEnabled",
            value: params.lightingEnabled ? "true" : "false",
            options: [
              { label: "ON", value: "true" },
              { label: "OFF", value: "false" }
            ],
            onChange: (e) => setParam({ lightingEnabled: e.value === "true" })
          })
        ]),
        !params.lightingEnabled ? null : ui.group({ direction: "col" }, [
          ui.group({ direction: "col" }, [
            ui.text({ text: t18("lightIntensity") }),
            ui.group({ direction: "row" }, [
              ui.slider({
                key: "lightIntensity",
                dataType: "float",
                min: 0,
                max: 1,
                value: params.lightIntensity
              }),
              ui.numberInput({
                key: "lightIntensity",
                dataType: "float",
                value: params.lightIntensity
              }),
              ui.button({
                text: t18("reset"),
                onClick: () => setParam({
                  lightIntensity: defaultValues.lightIntensity
                })
              })
            ])
          ]),
          ui.group({ direction: "col" }, [
            ui.text({ text: t18("lightDirection") }),
            ui.group({ direction: "row" }, [
              ui.slider({
                key: "lightAngle",
                dataType: "float",
                min: 0,
                max: 360,
                value: params.lightAngle
              }),
              ui.numberInput({
                key: "lightAngle",
                dataType: "float",
                value: params.lightAngle
              }),
              ui.button({
                text: t18("reset"),
                onClick: () => setParam({ lightAngle: defaultValues.lightAngle })
              })
            ])
          ]),
          ui.group({ direction: "col" }, [
            ui.text({ text: t18("depthEffect") }),
            ui.group({ direction: "row" }, [
              ui.slider({
                key: "depthEffect",
                dataType: "float",
                min: 0,
                max: 1,
                value: params.depthEffect
              }),
              ui.numberInput({
                key: "depthEffect",
                dataType: "float",
                value: params.depthEffect
              }),
              ui.button({
                text: t18("reset"),
                onClick: () => setParam({ depthEffect: defaultValues.depthEffect })
              })
            ])
          ]),
          ui.group({ direction: "col" }, [
            ui.text({ text: t18("surfaceRoughness") }),
            ui.group({ direction: "row" }, [
              ui.slider({
                key: "surfaceRoughness",
                dataType: "float",
                min: 0.05,
                max: 1,
                value: params.surfaceRoughness
              }),
              ui.numberInput({
                key: "surfaceRoughness",
                dataType: "float",
                value: params.surfaceRoughness
              }),
              ui.button({
                text: t18("reset"),
                onClick: () => setParam({
                  surfaceRoughness: defaultValues.surfaceRoughness
                })
              })
            ])
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Paper Texture Pro)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              lightingEnabled: u32,
              lightIntensity: f32,
              lightAngle: f32,
              depthEffect: f32,
              surfaceRoughness: f32,
            }

            @group(0) @binding(0) var baseTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // \u30CE\u30A4\u30BA\u95A2\u6570
            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            fn vnoise(p: vec2f) -> f32 {
              let i = floor(p);
              let f = fract(p);

              let a = hash(i.x + i.y * 57.0);
              let b = hash(i.x + 1.0 + i.y * 57.0);
              let c = hash(i.x + i.y * 57.0 + 1.0);
              let d = hash(i.x + 1.0 + i.y * 57.0 + 1.0);

              let u = f * f * (3.0 - 2.0 * f);

              return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            // \u6CD5\u7DDA\u30DE\u30C3\u30D7\u751F\u6210
            fn calculateNormal(texCoord: vec2f, texelSize: vec2f, inputMapping: vec2f) -> vec3f {
              let center = textureSampleLevel(baseTexture, textureSampler, texCoord * inputMapping, 0.0).r;
              let left = textureSampleLevel(baseTexture, textureSampler, (texCoord - vec2f(texelSize.x, 0.0)) * inputMapping, 0.0).r;
              let right = textureSampleLevel(baseTexture, textureSampler, (texCoord + vec2f(texelSize.x, 0.0)) * inputMapping, 0.0).r;
              let top = textureSampleLevel(baseTexture, textureSampler, (texCoord - vec2f(0.0, texelSize.y)) * inputMapping, 0.0).r;
              let bottom = textureSampleLevel(baseTexture, textureSampler, (texCoord + vec2f(0.0, texelSize.y)) * inputMapping, 0.0).r;

              let strength = params.depthEffect * 2.0;
              let dx = (right - left) * strength;
              let dy = (bottom - top) * strength;

              return normalize(vec3f(-dx, -dy, 1.0));
            }

            // \u7269\u7406\u30D9\u30FC\u30B9\u30E9\u30A4\u30C6\u30A3\u30F3\u30B0
            fn calculateLighting(normal: vec3f, roughness: f32) -> f32 {
              let lightDir = normalize(vec3f(cos(radians(params.lightAngle)), sin(radians(params.lightAngle)), 0.8));
              let viewDir = vec3f(0.0, 0.0, 1.0);
              let halfDir = normalize(lightDir + viewDir);

              // \u62E1\u6563\u53CD\u5C04\uFF08\u30E9\u30F3\u30D0\u30FC\u30C8\uFF09
              let diffuse = max(dot(normal, lightDir), 0.0);

              // \u93E1\u9762\u53CD\u5C04\uFF08GGX/Trowbridge-Reitz\uFF09
              let NdotH = max(dot(normal, halfDir), 0.0);
              let alpha = roughness * roughness;
              let D = alpha * alpha / (3.14159 * pow(NdotH * NdotH * (alpha * alpha - 1.0) + 1.0, 2.0));

              // \u30D5\u30EC\u30CD\u30EB\u9805\uFF08\u7C21\u6613\u7248\uFF09
              let F0 = 0.04;
              let F = F0 + (1.0 - F0) * pow(1.0 - max(dot(viewDir, halfDir), 0.0), 5.0);

              // \u5E7E\u4F55\u9805\uFF08\u7C21\u6613\u7248\uFF09
              let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
              let G = (max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0)) /
                     (max(dot(normal, viewDir), 0.0) * (1.0 - k) + k) *
                     (max(dot(normal, lightDir), 0.0) * (1.0 - k) + k);

              let specular = (D * F * G) / (4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001);

              // \u30A2\u30F3\u30D3\u30A8\u30F3\u30C8\u9805
              let ambient = 0.2;

              // \u6700\u7D42\u7684\u306A\u5149\u306E\u5F37\u3055
              return ambient + (diffuse + specular) * params.lightIntensity;
            }

            // \u7E4A\u7DAD\u306E\u6DF1\u5EA6\u52B9\u679C\u3092\u8FFD\u52A0
            fn addFiberDepth(baseColor: vec4f, texCoord: vec2f) -> vec4f {
              let noise1 = vnoise(texCoord * 1500.0) * 0.05;
              let noise2 = vnoise(texCoord * 500.0) * 0.1;

              // \u7E4A\u7DAD\u306E\u8272\u306B\u6DF1\u5EA6\u306B\u3088\u308B\u30D0\u30EA\u30A8\u30FC\u30B7\u30E7\u30F3\u3092\u52A0\u3048\u308B
              let depthVariation = mix(1.0, noise1 + noise2, params.depthEffect * 0.5);

              // \u7D19\u306E\u534A\u900F\u660E\u3055\u306B\u3088\u308B\u4E0D\u5747\u4E00\u306A\u8CEA\u611F
              let subsurface = vnoise(texCoord * 200.0) * params.depthEffect * 0.1;

              return vec4f(
                baseColor.rgb * (0.97 + depthVariation) + vec3f(subsurface),
                baseColor.a
              );
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(baseTexture));
              let dims = vec2f(params.outputSize);
              // \u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u8A08\u7B97 - \u3059\u3079\u3066\u306E\u8A08\u7B97\u3067\u3053\u306E\u5EA7\u6A19\u3092\u4F7F\u7528\u3059\u308B
              let texCoord = vec2f(id.xy) / dims;
              // \u5165\u529B\u30C6\u30AF\u30B9\u30C1\u30E3\u7A7A\u9593\u3078\u306E\u30DE\u30C3\u30D4\u30F3\u30B0 - \u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u6642\u306B\u5FC5\u9808
              let toInputTexCoord = dims / dimsWithGPUPadding;
              // DPI\u30B9\u30B1\u30FC\u30EB\u306B\u5408\u308F\u305B\u305F\u6B63\u898F\u5316\u5EA7\u6A19\u3078\u306E\u5909\u63DB
              let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

              // \u30D0\u30A6\u30F3\u30C7\u30A3\u30F3\u30B0\u30C1\u30A7\u30C3\u30AF
              if (texCoord.x > 1.0 || texCoord.y > 1.0) {
                return;
              }

              // \u5143\u306E\u30C6\u30AF\u30B9\u30C1\u30E3\u30AB\u30E9\u30FC\u3092\u53D6\u5F97
              let baseColor = textureSampleLevel(baseTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // WebGPU\u306B\u3088\u308B\u51E6\u7406\u3092\u884C\u308F\u306A\u3044\u5834\u5408\u306F\u305D\u306E\u307E\u307E\u51FA\u529B
              if (params.lightingEnabled == 0u) {
                textureStore(resultTexture, id.xy, baseColor);
                return;
              }

              // \u30C6\u30AF\u30B9\u30C1\u30E3\u304B\u3089\u30CE\u30FC\u30DE\u30EB\uFF08\u6CD5\u7DDA\uFF09\u30DE\u30C3\u30D7\u3092\u751F\u6210
              let texelSize = toScaledNomalizedAmountByPixels;
              let normal = calculateNormal(texCoord, texelSize, toInputTexCoord);

              // \u30E9\u30A4\u30C6\u30A3\u30F3\u30B0\u8A08\u7B97\uFF08\u7269\u7406\u30D9\u30FC\u30B9\uFF09
              let lighting = calculateLighting(normal, params.surfaceRoughness);

              // \u7E4A\u7DAD\u306E\u6DF1\u5EA6\u52B9\u679C
              let colorWithDepth = addFiberDepth(baseColor, texCoord);

              // \u6700\u7D42\u30AB\u30E9\u30FC
              let finalColor = vec4f(colorWithDepth.rgb * lighting, colorWithDepth.a);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Paper Texture Pro Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions18(code);
          const pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Paper Texture Generator Pro", params);
      const dpiScale = dpi / baseDpi;
      const normalizedWidth = Math.round(imgData.width / dpiScale);
      const normalizedHeight = Math.round(imgData.height / dpiScale);
      const random = new SeededRandom(params.seed);
      const paperParams = paperTypes[params.paperType];
      const fiberPlans = planFibers(
        normalizedWidth,
        normalizedHeight,
        paperParams,
        params.beatingDegree,
        params.fiberAmount,
        params.fiberDarkness,
        random
      );
      const baseCanvas = await createCanvas(imgData.width, imgData.height);
      const baseCtx = baseCanvas.getContext("2d");
      const renderRandom = new SeededRandom(params.seed);
      baseCtx.fillStyle = "white";
      baseCtx.fillRect(0, 0, imgData.width, imgData.height);
      addBaseTexture(
        baseCtx,
        imgData.width,
        imgData.height,
        paperParams,
        renderRandom,
        dpiScale
      );
      renderFibersFromPlan(baseCtx, fiberPlans, dpiScale);
      addCoating(baseCtx, imgData.width, imgData.height, paperParams);
      const baseTexture = baseCtx.getImageData(
        0,
        0,
        imgData.width,
        imgData.height
      );
      if (params.lightingEnabled) {
        const resultData = await processWithWebGPU(
          device,
          pipeline,
          pipelineDef,
          baseTexture,
          params,
          dpiScale
        );
        return resultData;
      } else {
        return baseTexture;
      }
    }
  }
});
async function processWithWebGPU(device, pipeline, pipelineDef, baseTexture, params, dpiScale) {
  const outputSize = { width: baseTexture.width, height: baseTexture.height };
  baseTexture = await addWebGPUAlignmentPadding(baseTexture);
  const inputTexture = device.createTexture({
    size: [baseTexture.width, baseTexture.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });
  const resultTexture = device.createTexture({
    size: [baseTexture.width, baseTexture.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
  });
  const sampler = device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest"
  });
  const uniformValues = makeStructuredView18(pipelineDef.uniforms.params);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  uniformValues.set({
    outputSize: [baseTexture.width, baseTexture.height],
    dpiScale,
    lightingEnabled: params.lightingEnabled ? 1 : 0,
    lightIntensity: params.lightIntensity,
    lightAngle: params.lightAngle,
    depthEffect: params.depthEffect,
    surfaceRoughness: params.surfaceRoughness
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
  device.queue.writeTexture(
    { texture: inputTexture },
    baseTexture.data,
    { bytesPerRow: baseTexture.width * 4 },
    [baseTexture.width, baseTexture.height]
  );
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: inputTexture.createView()
      },
      {
        binding: 1,
        resource: resultTexture.createView()
      },
      {
        binding: 2,
        resource: sampler
      },
      {
        binding: 3,
        resource: { buffer: uniformBuffer }
      }
    ]
  });
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(
    Math.ceil(baseTexture.width / 16),
    Math.ceil(baseTexture.height / 16)
  );
  passEncoder.end();
  const resultBuffer = device.createBuffer({
    size: baseTexture.width * baseTexture.height * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  commandEncoder.copyTextureToBuffer(
    { texture: resultTexture },
    { buffer: resultBuffer, bytesPerRow: baseTexture.width * 4 },
    [baseTexture.width, baseTexture.height]
  );
  device.queue.submit([commandEncoder.finish()]);
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const resultData = new Uint8ClampedArray(
    resultBuffer.getMappedRange().slice(0)
  );
  resultBuffer.unmap();
  return removeWebGPUAlignmentPadding(
    new ImageData(resultData, baseTexture.width, baseTexture.height),
    outputSize.width,
    outputSize.height
  );
}
var paperTypes = {
  woodfree: {
    type: "\u4E0A\u8CEA\u7D19",
    baseColor: "#f5f5f0",
    roughness: 0.3,
    fiberDensity: 0.7,
    coating: 0,
    gloss: 0.2,
    beatingDegree: 0.7,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: -20 },
      { ratio: 0.1, baseGrayOffset: 10 }
    ]
  },
  art: {
    type: "\u30A2\u30FC\u30C8\u7D19",
    baseColor: "#f4f4ec",
    roughness: 0.1,
    fiberDensity: 0.5,
    coating: 0.6,
    gloss: 0.75,
    beatingDegree: 0.9,
    fibers: [
      { ratio: 0.8, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: -15 }
    ]
  },
  coated: {
    type: "\u30B3\u30FC\u30C8\u7D19",
    baseColor: "#f8f8f5",
    roughness: 0.2,
    fiberDensity: 0.6,
    coating: 0.6,
    gloss: 0.7,
    beatingDegree: 0.8,
    fibers: [
      { ratio: 0.9, baseGrayOffset: 0 },
      { ratio: 0.1, baseGrayOffset: -10 }
    ]
  },
  machine: {
    type: "\u30DE\u30B7\u30F3\u7D19",
    baseColor: "#f2f2e8",
    roughness: 0.6,
    fiberDensity: 0.8,
    coating: 0,
    gloss: 0.1,
    beatingDegree: 0.5,
    fibers: [
      { ratio: 0.5, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -30 },
      { ratio: 0.2, baseGrayOffset: 20 }
    ]
  },
  lightCoated: {
    type: "\u5FAE\u5857\u5DE5\u7D19",
    baseColor: "#f4f4ec",
    roughness: 0.4,
    fiberDensity: 0.7,
    coating: 0.3,
    gloss: 0.4,
    beatingDegree: 0.6,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -15 }
    ]
  },
  kouzo: {
    type: "\u696E(\u3053\u3046\u305E)\u548C\u7D19 [\u548C\u7D19]",
    baseColor: "#f7f4e9",
    roughness: 0.8,
    fiberDensity: 0.5,
    coating: 0,
    gloss: 0.05,
    beatingDegree: 0.3,
    japanesePaper: true,
    fibers: [
      { ratio: 0.5, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -25 },
      { ratio: 0.2, baseGrayOffset: 15 }
    ]
  },
  mitsumata: {
    type: "\u4E09\u690F(\u307F\u3064\u307E\u305F)\u548C\u7D19 [\u548C\u7D19]",
    baseColor: "#f9f6ee",
    roughness: 0.6,
    fiberDensity: 0.6,
    coating: 0,
    gloss: 0.1,
    beatingDegree: 0.4,
    japanesePaper: true,
    fibers: [
      { ratio: 0.6, baseGrayOffset: 0 },
      { ratio: 0.4, baseGrayOffset: -20 }
    ]
  },
  ganpi: {
    type: "\u96C1\u76AE(\u304C\u3093\u3074)\u548C\u7D19 [\u548C\u7D19]",
    baseColor: "#f8f7f2",
    roughness: 0.4,
    fiberDensity: 0.7,
    coating: 0,
    gloss: 0.15,
    beatingDegree: 0.5,
    japanesePaper: true,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: 20 }
    ]
  },
  tengujou: {
    type: "\u5178\u5177\u5E16(\u3066\u3093\u3050\u3058\u3087\u3046)\u7D19 [\u548C\u7D19]",
    baseColor: "#fffcf5",
    roughness: 0.2,
    fiberDensity: 0.8,
    coating: 0,
    gloss: 0.2,
    beatingDegree: 0.6,
    japanesePaper: true,
    fibers: [
      { ratio: 0.8, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: 15 }
    ]
  },
  tousagami: {
    type: "\u571F\u4F50(\u3068\u3046\u3055)\u548C\u7D19 [\u548C\u7D19]",
    baseColor: "#f6f3e8",
    roughness: 0.7,
    fiberDensity: 0.55,
    coating: 0,
    gloss: 0.08,
    beatingDegree: 0.35,
    japanesePaper: true,
    fibers: [
      { ratio: 0.4, baseGrayOffset: 0 },
      { ratio: 0.4, baseGrayOffset: -25 },
      { ratio: 0.2, baseGrayOffset: 20 }
    ]
  }
};
var SeededRandom = class {
  seed;
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    const x = Math.sin(this.seed++) * 1e4;
    return x - Math.floor(x);
  }
};
function addBaseTexture(ctx, width, height, params, random, dpiScale = 1) {
  const scaledSize = Math.max(1, Math.round(dpiScale));
  const noiseBlockSize = Math.max(1, Math.floor(scaledSize));
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let y = 0; y < height; y += noiseBlockSize) {
    for (let x = 0; x < width; x += noiseBlockSize) {
      const noise = Math.floor(255 - random.next() * params.roughness * 40);
      for (let dy = 0; dy < noiseBlockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < noiseBlockSize && x + dx < width; dx++) {
          const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
          pixels[pixelIndex] = noise;
          pixels[pixelIndex + 1] = noise;
          pixels[pixelIndex + 2] = noise;
          pixels[pixelIndex + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
function planFibers(width, height, params, beatingDegree, fiberAmount, fiberDarkness, random) {
  const fiberPlans = [];
  const baseCount = 300 * fiberAmount;
  const fiberCount = Math.floor(
    baseCount * (params.fiberDensity * (0.5 + beatingDegree * 0.5))
  );
  const fibers = params.fibers || [{ ratio: 1, baseGrayOffset: 0 }];
  for (const fiber of fibers) {
    const fiberTypeCount = Math.floor(fiberCount * fiber.ratio);
    const baseGray = Math.floor(250 - fiberDarkness * 100) + fiber.baseGrayOffset;
    for (let i = 0; i < fiberTypeCount; i++) {
      const x = random.next() * width;
      const y = random.next() * height;
      const fiberLength = 20 + random.next() * (80 * (1 - beatingDegree));
      const fiberWidth = 0.2 + (1 - beatingDegree) * 1.5;
      const angle = random.next() * Math.PI * (1 + (1 - beatingDegree));
      if (params.japanesePaper) {
        const japaneseFiberPlan = planJapanesePaperFiber(
          x,
          y,
          fiberLength,
          fiberWidth,
          angle,
          random,
          baseGray
        );
        fiberPlans.push({
          type: "japanese",
          plan: japaneseFiberPlan,
          baseGray
        });
      } else {
        fiberPlans.push({
          type: "regular",
          x,
          y,
          length: fiberLength,
          width: fiberWidth,
          angle,
          gray: Math.floor(baseGray - random.next() * 10),
          hasMicroFibers: beatingDegree > 0.5,
          microFibers: beatingDegree > 0.5 ? Math.floor(beatingDegree * 8) : 0,
          microDetails: beatingDegree > 0.5 ? Array.from({ length: Math.floor(beatingDegree * 8) }, () => ({
            length: fiberLength * 0.2,
            angle: angle + (random.next() - 0.5) * Math.PI * (1 - beatingDegree),
            gray: Math.floor(baseGray + 10 - random.next() * 10)
          })) : []
        });
      }
    }
  }
  return fiberPlans;
}
function planJapanesePaperFiber(x, y, baseLength, baseWidth, angle, random, baseGray) {
  const plan = {
    mainPath: [],
    branches: [],
    baseWidth,
    currentGray: baseGray - Math.floor(random.next() * 10),
    finalGray: 0
  };
  let currentAngle = angle;
  let currentX = x;
  let currentY = y;
  let currentWidth = baseWidth;
  let currentGray = baseGray - Math.floor(random.next() * 10);
  plan.mainPath.push([currentX, currentY]);
  const segments = Math.floor(5 + random.next() * 5);
  const totalLength = baseLength * (1.5 + random.next());
  const segmentLength = totalLength / segments;
  for (let i = 0; i < segments; i++) {
    const thisSegmentLength = segmentLength * (0.8 + random.next() * 0.4);
    const angleVariation = (random.next() - 0.5) * Math.PI * 0.3;
    currentAngle += angleVariation;
    currentGray += (random.next() - 0.5) * 20;
    currentGray = Math.max(baseGray - 30, Math.min(baseGray + 10, currentGray));
    currentX += Math.cos(currentAngle) * thisSegmentLength;
    currentY += Math.sin(currentAngle) * thisSegmentLength;
    plan.mainPath.push([currentX, currentY]);
    if (random.next() < 0.2 && plan.mainPath.length > 1) {
      const branchAngle = currentAngle + (random.next() - 0.5) * Math.PI * 0.7;
      const branchLength = thisSegmentLength * (0.4 + random.next() * 0.8);
      const branchWidth = currentWidth * (0.5 + random.next() * 0.3);
      const branchX = currentX + Math.cos(branchAngle) * branchLength;
      const branchY = currentY + Math.sin(branchAngle) * branchLength;
      const branchGray = currentGray + (random.next() - 0.5) * 20;
      const branch = {
        start: [currentX, currentY],
        end: [branchX, branchY],
        width: branchWidth,
        gray: branchGray,
        subBranch: null
      };
      if (random.next() < 0.3) {
        const subBranchAngle = branchAngle + (random.next() - 0.5) * Math.PI * 0.5;
        const subBranchLength = branchLength * 0.6;
        const subBranchX = branchX + Math.cos(subBranchAngle) * subBranchLength;
        const subBranchY = branchY + Math.sin(subBranchAngle) * subBranchLength;
        branch.subBranch = {
          start: [branchX, branchY],
          end: [subBranchX, subBranchY],
          width: branchWidth * 0.7,
          gray: branchGray + 10
        };
      }
      plan.branches.push(branch);
    }
    currentWidth *= 0.9 + random.next() * 0.2;
  }
  plan.finalGray = currentGray;
  return plan;
}
function renderFibersFromPlan(ctx, fiberPlans, dpiScale) {
  for (const fiber of fiberPlans) {
    if (fiber.type === "japanese") {
      renderJapaneseFiberFromPlan(ctx, fiber.plan, dpiScale);
    } else {
      ctx.beginPath();
      ctx.moveTo(fiber.x * dpiScale, fiber.y * dpiScale);
      ctx.lineTo(
        (fiber.x + Math.cos(fiber.angle) * fiber.length) * dpiScale,
        (fiber.y + Math.sin(fiber.angle) * fiber.length) * dpiScale
      );
      ctx.strokeStyle = `rgb(${fiber.gray}, ${fiber.gray}, ${fiber.gray})`;
      ctx.lineWidth = fiber.width * dpiScale;
      ctx.stroke();
      if (fiber.hasMicroFibers) {
        for (const micro of fiber.microDetails) {
          ctx.beginPath();
          ctx.moveTo(fiber.x * dpiScale, fiber.y * dpiScale);
          ctx.lineTo(
            (fiber.x + Math.cos(micro.angle) * micro.length) * dpiScale,
            (fiber.y + Math.sin(micro.angle) * micro.length) * dpiScale
          );
          ctx.strokeStyle = `rgb(${micro.gray}, ${micro.gray}, ${micro.gray})`;
          ctx.lineWidth = fiber.width * 0.3 * dpiScale;
          ctx.stroke();
        }
      }
    }
  }
}
function renderJapaneseFiberFromPlan(ctx, plan, dpiScale) {
  for (const branch of plan.branches) {
    ctx.beginPath();
    ctx.moveTo(branch.start[0] * dpiScale, branch.start[1] * dpiScale);
    ctx.lineTo(branch.end[0] * dpiScale, branch.end[1] * dpiScale);
    ctx.strokeStyle = `rgb(${branch.gray}, ${branch.gray}, ${branch.gray})`;
    ctx.lineWidth = branch.width * dpiScale;
    ctx.stroke();
    if (branch.subBranch) {
      ctx.beginPath();
      ctx.moveTo(
        branch.subBranch.start[0] * dpiScale,
        branch.subBranch.start[1] * dpiScale
      );
      ctx.lineTo(
        branch.subBranch.end[0] * dpiScale,
        branch.subBranch.end[1] * dpiScale
      );
      ctx.strokeStyle = `rgb(${branch.subBranch.gray}, ${branch.subBranch.gray}, ${branch.subBranch.gray})`;
      ctx.lineWidth = branch.subBranch.width * dpiScale;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(plan.mainPath[0][0] * dpiScale, plan.mainPath[0][1] * dpiScale);
  for (let i = 1; i < plan.mainPath.length; i++) {
    const [px, py] = plan.mainPath[i];
    ctx.lineTo(px * dpiScale, py * dpiScale);
  }
  ctx.strokeStyle = `rgb(${plan.finalGray}, ${plan.finalGray}, ${plan.finalGray})`;
  ctx.lineWidth = plan.baseWidth * dpiScale;
  ctx.stroke();
}
function addCoating(ctx, width, height, params) {
  if (params.coating > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${params.coating * 0.2})`;
    ctx.fillRect(0, 0, width, height);
  }
}

// src/js/src/live-effects/comic-tone.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions19,
  makeStructuredView as makeStructuredView19
} from "npm:webgpu-utils";
var t19 = createTranslator({
  en: {
    title: "Comic Tone V1",
    toneType: "Tone Type",
    dot: "Dot",
    line: "Line",
    crosshatch: "Crosshatch",
    colorMode: "Color Mode",
    originalColor: "Sample Original",
    monochrome: "Monochrome",
    size: "Size (px)",
    spacing: "Spacing (px)",
    angle: "Angle",
    threshold: "Brightness Cutoff",
    toneColor: "Tone Color",
    reversePattern: "Reverse Pattern",
    useLuminance: "Size by Luminance",
    luminanceStrength: "Luminance Strength",
    invertDotSize: "Invert Dot Size",
    showOriginalUnderDots: "Show Original Under Dots"
  },
  ja: {
    title: "\u30DE\u30F3\u30AC\u30C8\u30FC\u30F3 V1",
    toneType: "\u30C8\u30FC\u30F3\u30BF\u30A4\u30D7",
    dot: "\u30C9\u30C3\u30C8",
    line: "\u30E9\u30A4\u30F3",
    crosshatch: "\u30AF\u30ED\u30B9",
    colorMode: "\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9",
    originalColor: "\u5143\u30AB\u30E9\u30FC\u3092\u30B5\u30F3\u30D7\u30EB",
    monochrome: "\u30E2\u30CE\u30C8\u30FC\u30F3",
    size: "\u30B5\u30A4\u30BA (px)",
    spacing: "\u9593\u9694 (px)",
    angle: "\u89D2\u5EA6",
    threshold: "\u660E\u308B\u3055\u30AB\u30C3\u30C8\u30AA\u30D5",
    toneColor: "\u30C8\u30FC\u30F3\u8272",
    reversePattern: "\u30D1\u30BF\u30FC\u30F3\u3092\u53CD\u8EE2",
    useLuminance: "\u8F1D\u5EA6\u3067\u30B5\u30A4\u30BA\u5909\u66F4",
    luminanceStrength: "\u8F1D\u5EA6\u306E\u5F71\u97FF\u5EA6",
    invertDotSize: "\u30C9\u30C3\u30C8\u30B5\u30A4\u30BA\u3092\u53CD\u8EE2",
    showOriginalUnderDots: "\u30C9\u30C3\u30C8\u4E0B\u306B\u5143\u753B\u50CF\u3092\u8868\u793A"
  }
});
var TONE_TYPES = {
  DOT: "dot",
  LINE: "line",
  CROSSHATCH: "crosshatch"
};
var COLOR_MODES = {
  ORIGINAL: "original",
  MONOCHROME: "monochrome"
};
var comicTone = definePlugin({
  id: "comic-tone-v1",
  title: t19("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      toneType: {
        type: "string",
        enum: [TONE_TYPES.DOT, TONE_TYPES.LINE, TONE_TYPES.CROSSHATCH],
        default: TONE_TYPES.DOT
      },
      colorMode: {
        type: "string",
        enum: [COLOR_MODES.ORIGINAL, COLOR_MODES.MONOCHROME],
        default: COLOR_MODES.ORIGINAL
      },
      size: {
        type: "real",
        default: 3
      },
      spacing: {
        type: "real",
        default: 10
      },
      angle: {
        type: "real",
        default: 45
      },
      threshold: {
        type: "real",
        default: 1
      },
      reversePattern: {
        type: "bool",
        default: false
      },
      showOriginalUnderDots: {
        type: "bool",
        default: true
      },
      useLuminance: {
        type: "bool",
        default: true
      },
      luminanceStrength: {
        type: "real",
        default: 0.5
      },
      invertDotSize: {
        type: "bool",
        default: false
      },
      toneColor: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        size: Math.max(0.5, params.size),
        spacing: Math.max(1, params.spacing),
        threshold: Math.max(0, Math.min(1, params.threshold))
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        toneColor: adjustColor(params.toneColor)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor,
        spacing: params.spacing * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        toneType: t22 < 0.5 ? paramsA.toneType : paramsB.toneType,
        colorMode: t22 < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        size: lerp(paramsA.size, paramsB.size, t22),
        spacing: lerp(paramsA.spacing, paramsB.spacing, t22),
        angle: lerp(paramsA.angle, paramsB.angle, t22),
        threshold: lerp(paramsA.threshold, paramsB.threshold, t22),
        reversePattern: t22 < 0.5 ? paramsA.reversePattern : paramsB.reversePattern,
        showOriginalUnderDots: t22 < 0.5 ? paramsA.showOriginalUnderDots : paramsB.showOriginalUnderDots,
        useLuminance: t22 < 0.5 ? paramsA.useLuminance : paramsB.useLuminance,
        luminanceStrength: lerp(
          paramsA.luminanceStrength,
          paramsB.luminanceStrength,
          t22
        ),
        invertDotSize: t22 < 0.5 ? paramsA.invertDotSize : paramsB.invertDotSize,
        toneColor: {
          r: lerp(paramsA.toneColor.r, paramsB.toneColor.r, t22),
          g: lerp(paramsA.toneColor.g, paramsB.toneColor.g, t22),
          b: lerp(paramsA.toneColor.b, paramsB.toneColor.b, t22),
          a: lerp(paramsA.toneColor.a, paramsB.toneColor.a, t22)
        }
      };
    },
    renderUI: (params, { setParam }) => {
      const toneColorStr = toColorCode(params.toneColor);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t19("toneType") }),
          ui.select({
            key: "toneType",
            value: params.toneType,
            options: [
              { label: t19("dot"), value: TONE_TYPES.DOT },
              { label: t19("line"), value: TONE_TYPES.LINE },
              { label: t19("crosshatch"), value: TONE_TYPES.CROSSHATCH }
            ]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t19("colorMode") }),
          ui.select({
            key: "colorMode",
            value: params.colorMode,
            options: [
              { label: t19("originalColor"), value: COLOR_MODES.ORIGINAL },
              { label: t19("monochrome"), value: COLOR_MODES.MONOCHROME }
            ]
          })
        ]),
        params.colorMode === COLOR_MODES.ORIGINAL && params.toneType === TONE_TYPES.DOT ? null : null,
        ui.group({ direction: "col" }, [
          ui.text({ text: t19("size") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "size",
              dataType: "float",
              min: 0.5,
              max: 20,
              value: params.size
            }),
            ui.numberInput({
              key: "size",
              dataType: "float",
              value: params.size
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t19("spacing") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "spacing",
              dataType: "float",
              min: 1,
              max: 40,
              value: params.spacing
            }),
            ui.numberInput({
              key: "spacing",
              dataType: "float",
              value: params.spacing
            })
          ])
        ]),
        params.toneType !== TONE_TYPES.DOT ? ui.group({ direction: "col" }, [
          ui.text({ text: t19("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "angle",
              dataType: "float",
              min: 0,
              max: 180,
              value: params.angle
            }),
            ui.numberInput({
              key: "angle",
              dataType: "float",
              value: params.angle
            })
          ])
        ]) : null,
        ui.group({ direction: "col" }, [
          ui.text({ text: t19("threshold") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "threshold",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.threshold
            }),
            ui.numberInput({
              key: "threshold",
              dataType: "float",
              value: params.threshold
            })
          ])
        ]),
        // ui.checkbox({
        //   key: "reversePattern",
        //   label: t("reversePattern"),
        //   value: params.reversePattern,
        // }),
        params.toneType === TONE_TYPES.DOT ? ui.checkbox({
          key: "showOriginalUnderDots",
          label: t19("showOriginalUnderDots"),
          value: params.showOriginalUnderDots
        }) : null,
        ui.checkbox({
          key: "useLuminance",
          label: t19("useLuminance"),
          value: params.useLuminance
        }),
        params.useLuminance ? ui.group({ direction: "col" }, [
          ui.checkbox({
            key: "invertDotSize",
            label: t19("invertDotSize"),
            value: params.invertDotSize
          }),
          ui.text({ text: t19("luminanceStrength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "luminanceStrength",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.luminanceStrength
            }),
            ui.numberInput({
              key: "luminanceStrength",
              dataType: "float",
              value: params.luminanceStrength
            })
          ])
        ]) : null,
        params.colorMode === COLOR_MODES.MONOCHROME ? ui.group({ direction: "col" }, [
          ui.text({ text: t19("toneColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({ key: "toneColor", value: params.toneColor }),
            ui.textInput({
              key: "toneColorInput",
              value: toneColorStr,
              onChange: (e) => {
                setParam({ toneColor: parseColorCode(e.value) });
              }
            })
          ])
        ]) : null
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Comic Tone V1)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              toneType: u32,
              colorMode: u32,
              size: f32,
              spacing: f32,
              angle: f32,
              threshold: f32,
              reversePattern: u32,
              showOriginalUnderDots: u32,
              useLuminance: u32,
              luminanceStrength: f32,
              invertDotSize: u32,
              toneColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Constants for tone type
            const TONE_DOT = 0u;
            const TONE_LINE = 1u;
            const TONE_CROSSHATCH = 2u;

            // Constants for color mode
            const COLOR_ORIGINAL = 0u;
            const COLOR_MONOCHROME = 1u;

            // Custom modulo function for floating point values
            fn mod_f32(x: f32, y: f32) -> f32 {
              return x - y * floor(x / y);
            }

            // Creates dot pattern at the given position with size affected by luminance
            fn createDotPattern(pos: vec2f, baseSize: f32, spacing: f32, luminance: f32, useLuminance: u32, luminanceStrength: f32, invertDotSize: u32) -> f32 {
              let scaledPos = pos / spacing;
              let cell = floor(scaledPos);
              let cellCenter = (cell + 0.5) * spacing;

              // Calculate size based on luminance if enabled
              var size = baseSize;
              if (useLuminance != 0u) {
                var luminanceEffect = luminance;

                // Invert luminance effect if needed
                if (invertDotSize != 0u) {
                  luminanceEffect = 1.0 - luminanceEffect;
                }

                // Apply luminance effect based on strength parameter
                // Size varies from 0.2x to 1.8x of the base size
                let sizeFactor = mix(0.2, 1.8, luminanceEffect);
                size = baseSize * mix(1.0, sizeFactor, luminanceStrength);
              }

              let dist = distance(pos, cellCenter);
              return 1.0 - smoothstep(size * 0.5 - 1.0, size * 0.5, dist);
            }

            // Creates line pattern at the given position and angle
            fn createLinePattern(pos: vec2f, size: f32, spacing: f32, angleRad: f32) -> f32 {
              let rotatedPos = vec2f(
                pos.x * cos(angleRad) - pos.y * sin(angleRad),
                pos.x * sin(angleRad) + pos.y * cos(angleRad)
              );
              let modPos = abs(mod_f32(rotatedPos.y, spacing));
              // Fixed: Size parameter now directly controls line thickness
              return smoothstep(size, size - 1.0, modPos);
            }

            // Creates crosshatch pattern by combining two line patterns at perpendicular angles
            fn createCrosshatchPattern(pos: vec2f, size: f32, spacing: f32, angleRad: f32) -> f32 {
              let pattern1 = createLinePattern(pos, size, spacing, angleRad);
              let pattern2 = createLinePattern(pos, size, spacing, angleRad + 1.5708); // 90 degrees
              return max(pattern1, pattern2);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Handle straight alpha (non-premultiplied)
              // Safely get RGB components considering alpha to avoid division by zero
              var straightRgb = originalColor.rgb;
              if (originalColor.a > 0.001) {
                // Convert from premultiplied to straight alpha if needed
                straightRgb = straightRgb / originalColor.a;
              }

              // Calculate brightness for threshold comparison using straight RGB
              let brightness = (straightRgb.r + straightRgb.g + straightRgb.b) / 3.0;

              // Apply DPI scaling to size and spacing
              var scaledSize = params.size * params.dpiScale;
              let scaledSpacing = params.spacing * params.dpiScale;

              // Adjust size based on luminance if enabled
              if (params.useLuminance != 0u) {
                var luminanceEffect = brightness;

                // Invert luminance effect if needed - ONLY affects size calculation, not color
                if (params.invertDotSize != 0u) {
                  luminanceEffect = 1.0 - luminanceEffect;
                }

                // Apply luminance effect based on strength parameter
                // Scale between 0.2x and 2x of the base size
                let sizeFactor = mix(0.2, 2.0, luminanceEffect);
                scaledSize = scaledSize * mix(1.0, sizeFactor, params.luminanceStrength);
              }

              // Calculate angle in radians
              let angleRad = params.angle * 3.14159265359 / 180.0;

              // Generate tone pattern based on selected type
              var pattern = 0.0;
              let pixelPos = vec2f(id.xy);

              // Check for alpha edge - pixels with alpha but surrounded by transparent pixels often cause edge artifacts
              var isAlphaEdge = false;
              if (originalColor.a > 0.01 && originalColor.a < 0.99) {
                // Simple edge detection - sample surrounding pixels
                // Use DPI-independent sampling distance
                let sampleDistance = 1.0 / params.dpiScale;
                // Apply edge correction factor
                var edgeCount = 0;

                // Sample in cardinal directions
                for (var dx = -1; dx <= 1; dx++) {
                  for (var dy = -1; dy <= 1; dy++) {
                    if (dx == 0 && dy == 0) { continue; } // Skip center

                    // Convert integer dx, dy to float for the vector math
                    let fdx = f32(dx);
                    let fdy = f32(dy);
                    // Scale sampling distance by DPI to ensure consistent behavior
                    let neighborCoord = texCoord + vec2f(fdx, fdy) * (vec2f(sampleDistance, sampleDistance) / dims);
                    // Skip out of bounds
                    if (neighborCoord.x < 0.0 || neighborCoord.x > 1.0 || neighborCoord.y < 0.0 || neighborCoord.y > 1.0) {
                      continue;
                    }

                    let neighborColor = textureSampleLevel(inputTexture, textureSampler, neighborCoord * toInputTexCoord, 0.0);
                    // Adjust threshold based on DPI scale for consistent detection
                    // Apply edge correction factor to fine-tune sensitivity
                    let alphaThreshold = (0.3 / sqrt(params.dpiScale));
                    if (abs(neighborColor.a - originalColor.a) > alphaThreshold) {
                      edgeCount++;
                    }
                  }
                }

                // If we have enough surrounding pixels with different alpha, consider this an edge
                // For higher DPI, require more evidence to classify as an edge
                // Apply edge correction factor to threshold
                let edgeThreshold = max(2.0, min(4.0, 2.0 * sqrt(params.dpiScale)));
                isAlphaEdge = f32(edgeCount) >= edgeThreshold;
              }

              if (params.toneType == TONE_DOT) {
                // For dot pattern, we will directly check dot membership later
                // and not use the pattern value
                pattern = 0.0;
              } else if (params.toneType == TONE_LINE) {
                pattern = createLinePattern(pixelPos, scaledSize, scaledSpacing, angleRad);
              } else if (params.toneType == TONE_CROSSHATCH) {
                pattern = createCrosshatchPattern(pixelPos, scaledSize, scaledSpacing, angleRad);
              }

              // Apply brightness threshold and pattern reversal
              var toneValue = pattern;

              // Apply pattern reversal if needed
              if (params.reversePattern != 0u) {
                toneValue = 1.0 - toneValue;
              }

              // For non-dot patterns: skip drawing pattern where brightness >= threshold
              // Also skip at alpha edges to prevent artifacts
              if (brightness >= params.threshold || isAlphaEdge) {
                toneValue = 0.0;
              }

              // Determine final color based on color mode and tone type
              var finalColor: vec4f;

              if (params.toneType == TONE_DOT) {
                // Special processing for dot pattern
                // Calculate which dot cell this pixel belongs to
                let scaledPos = pixelPos / scaledSpacing;
                let cell = floor(scaledPos);
                let cellCenter = (cell + 0.5) * scaledSpacing;

                // Calculate distance from this pixel to cell center
                let distToDotCenter = distance(pixelPos, cellCenter);

                // Basic dot radius (half the size)
                let baseRadius = scaledSize * 0.5;

                // Get the luminance at the dot cell center and adjust dot size based on it
                let dotCenterTexCoord = cellCenter / dims;
                var finalDotRadius = baseRadius;
                var skipDot = false;
                var dotCenterBrightness = 0.0;
                var dotCenterColor = vec4f(0.0, 0.0, 0.0, 1.0);
                // Declare this variable at a higher scope level
                var straightDotRgb = vec3f(0.0, 0.0, 0.0);

                if (dotCenterTexCoord.x <= 1.0 && dotCenterTexCoord.y <= 1.0) {
                  // Sample the color at cell center
                  dotCenterColor = textureSampleLevel(inputTexture, textureSampler, dotCenterTexCoord * toInputTexCoord, 0.0);

                  // Handle straight alpha for dot center color (updating the variable declared above)
                  straightDotRgb = dotCenterColor.rgb;
                  if (dotCenterColor.a > 0.001) {
                    // Convert from premultiplied to straight alpha if needed
                    straightDotRgb = straightDotRgb / dotCenterColor.a;
                  }

                  // Calculate brightness based on straight RGB
                  dotCenterBrightness = (straightDotRgb.r + straightDotRgb.g + straightDotRgb.b) / 3.0;

                  // Check if brightness exceeds threshold - if so, don't draw dot
                  // Also skip dots at alpha edges
                  if (dotCenterBrightness >= params.threshold || isAlphaEdge) {
                    skipDot = true;
                  }

                  // Size adjustment based on luminance
                  if (!skipDot && params.useLuminance != 0u) {
                    var luminanceEffect = dotCenterBrightness;

                    // Invert luminance effect if needed
                    if (params.invertDotSize != 0u) {
                      luminanceEffect = 1.0 - luminanceEffect;
                    }

                    // Size calculation: ranging from 0.5x to 1.5x (middle value is 1.0x)
                    let sizeFactor = mix(0.5, 1.5, luminanceEffect);
                    finalDotRadius = baseRadius * mix(1.0, sizeFactor, params.luminanceStrength);
                  }
                }

                // Determine if pixel is inside dot using the adjusted radius AND not skipped due to threshold
                let isInsideDot = !skipDot && distToDotCenter < finalDotRadius;

                if (isInsideDot) {
                  // Inside dot - use color sampled from center
                  if (params.colorMode == COLOR_ORIGINAL) {
                    // Use straight RGB for calculating the final color
                    var resultAlpha = dotCenterColor.a;
                    var resultRgb = vec3f(0.0);

                    // Multiply straight RGB values
                    if (originalColor.a > 0.001 && dotCenterColor.a > 0.001) {
                      resultRgb = straightDotRgb * straightRgb;
                    }

                    // Convert back to premultiplied alpha for output
                    finalColor = vec4f(resultRgb * resultAlpha, resultAlpha);
                  } else {
                    // Use tone color in monochrome mode
                    // Apply the alpha from dot center color
                    finalColor = vec4f(params.toneColor.rgb * dotCenterColor.a, dotCenterColor.a);
                  }
                } else {
                  // Outside dot - show original image or make completely transparent
                  if (params.showOriginalUnderDots != 0u) {
                    finalColor = originalColor;
                  } else {
                    finalColor = vec4f(0.0, 0.0, 0.0, 0.0); // Completely transparent
                  }
                }
              } else {
                // Other tone patterns (line, crosshatch)
                let alpha = originalColor.a;

                if (params.colorMode == COLOR_ORIGINAL) {
                  // For original color mode
                  if (toneValue > 0.5) {
                    // Tone pattern area (white in traditional tone)
                    // For alpha edges, create a smoother transition
                    if (isAlphaEdge) {
                      // Mix with original color to prevent white edges
                      // For higher DPI, use more subtle blending
                      let edgeFactor = min(0.7, originalColor.a) / pow(params.dpiScale, 0.25);
                      let whiteColor = vec4f(alpha, alpha, alpha, alpha);
                      finalColor = mix(originalColor, whiteColor, edgeFactor);
                    } else {
                      // Use premultiplied alpha for output
                      finalColor = vec4f(alpha, alpha, alpha, alpha);
                    }
                  } else {
                    // Non-tone area (keeping original color)
                    // Original color already has correct alpha handling
                    finalColor = originalColor;
                  }
                } else {
                  // Monochrome with tone pattern
                  if (toneValue > 0.5) {
                    // Tone pattern area (white in traditional tone)
                    if (isAlphaEdge) {
                      // Mix with tone color to prevent white edges
                      // For higher DPI, use more subtle blending
                      let edgeFactor = min(0.7, originalColor.a) / pow(params.dpiScale, 0.25);
                      let whiteColor = vec4f(alpha, alpha, alpha, alpha);
                      let toneColorPremult = vec4f(params.toneColor.rgb * alpha, alpha);
                      finalColor = mix(toneColorPremult, whiteColor, edgeFactor);
                    } else {
                      // Use premultiplied alpha for output
                      finalColor = vec4f(alpha, alpha, alpha, alpha);
                    }
                  } else {
                    // Non-tone area (using tone color)
                    // Apply premultiplied alpha for output
                    finalColor = vec4f(params.toneColor.rgb * alpha, alpha);
                  }
                }
              }

              // Apply alpha cutoff from original image
              if (originalColor.a < 0.01) {
                finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
              } else if (finalColor.a > 0.0 && finalColor.a < 0.05) {
                // For very low but non-zero alpha, use original color but with reduced alpha
                // This helps prevent "ghost" edges
                finalColor = vec4f(originalColor.rgb, originalColor.a * 0.5);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Comic Tone V1 Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions19(code);
          const pipeline = device.createComputePipeline({
            label: "Comic Tone V1 Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Comic Tone V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData, true);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Comic Tone Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Comic Tone Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Comic Tone Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView19(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Comic Tone Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const toneTypeMap = {
        [TONE_TYPES.DOT]: 0,
        [TONE_TYPES.LINE]: 1,
        [TONE_TYPES.CROSSHATCH]: 2
      };
      const colorModeMap = {
        [COLOR_MODES.ORIGINAL]: 0,
        [COLOR_MODES.MONOCHROME]: 1
      };
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        toneType: toneTypeMap[params.toneType],
        colorMode: colorModeMap[params.colorMode],
        size: params.size,
        spacing: params.spacing,
        angle: params.angle,
        threshold: params.threshold,
        reversePattern: params.reversePattern ? 1 : 0,
        showOriginalUnderDots: params.showOriginalUnderDots ? 1 : 0,
        useLuminance: params.useLuminance ? 1 : 0,
        luminanceStrength: params.luminanceStrength,
        invertDotSize: params.invertDotSize ? 1 : 0,
        toneColor: [
          params.toneColor.r,
          params.toneColor.g,
          params.toneColor.b,
          params.toneColor.a
        ]
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Comic Tone Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Comic Tone Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/gradient-map.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions20,
  makeStructuredView as makeStructuredView20
} from "npm:webgpu-utils";
var t20 = createTranslator({
  en: {
    title: "Gradient Map",
    preset: "Presets",
    custom: "Custom",
    blackAndWhite: "B&W",
    sepia: "Sepia",
    duotone: "Duotone",
    rainbow: "Rainbow",
    colorStops: "Colors",
    addStop: "Add Color",
    position: "Pos",
    jsonEdit: "Edit as JSON",
    sortByPosition: "Sort by Position",
    colorAdjustment: "Color Adjustment",
    hue: "Hue",
    saturation: "Saturation",
    lightness: "Lightness",
    apply: "Apply to All Colors",
    strength: "Strength"
  },
  ja: {
    title: "\u30B0\u30E9\u30C7\u30FC\u30B7\u30E7\u30F3\u30DE\u30C3\u30D7",
    preset: "\u30D7\u30EA\u30BB\u30C3\u30C8",
    custom: "\u30AB\u30B9\u30BF\u30E0",
    blackAndWhite: "\u767D\u9ED2",
    sepia: "\u30BB\u30D4\u30A2",
    duotone: "\u30C4\u30FC\u30C8\u30F3",
    rainbow: "\u8679\u8272",
    colorStops: "\u30AB\u30E9\u30FC",
    addStop: "\u8272\u3092\u8FFD\u52A0",
    position: "\u4F4D\u7F6E",
    jsonEdit: "JSON\u3067\u7DE8\u96C6",
    sortByPosition: "\u4F4D\u7F6E\u3067\u4E26\u3073\u66FF\u3048",
    colorAdjustment: "\u8272\u8ABF\u88DC\u6B63",
    hue: "\u8272\u76F8",
    saturation: "\u5F69\u5EA6",
    lightness: "\u660E\u5EA6",
    apply: "\u3059\u3079\u3066\u306E\u8272\u306B\u9069\u7528",
    strength: "\u9069\u7528\u5EA6"
  }
});
var PRESETS = {
  custom: null,
  // Custom is handled separately
  blackAndWhite: [
    { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
  ],
  sepia: [
    { color: { r: 0.2, g: 0.05, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 0.9, b: 0.7, a: 1 }, position: 1 }
  ],
  duotone: [
    { color: { r: 0.05, g: 0.2, b: 0.6, a: 1 }, position: 0 },
    { color: { r: 1, g: 0.8, b: 0.2, a: 1 }, position: 1 }
  ],
  rainbow: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 0, a: 1 }, position: 0.2 },
    { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0.4 },
    { color: { r: 0, g: 1, b: 1, a: 1 }, position: 0.6 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 0.8 },
    { color: { r: 1, g: 0, b: 1, a: 1 }, position: 1 }
  ]
};
function colorToHsvString(color) {
  const r = color.r;
  const g = color.g;
  const b = color.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta === 0) {
    h = 0;
  } else if (max === r) {
    h = (g - b) / delta % 6;
    if (h < 0) h += 6;
    h *= 60;
  } else if (max === g) {
    h = ((b - r) / delta + 2) * 60;
  } else {
    h = ((r - g) / delta + 4) * 60;
  }
  const s = max === 0 ? 0 : delta / max * 100;
  const v = max * 100;
  return `hsv(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(v)}%)`;
}
function adjustHsv(h, s, v, hueAdjust, saturationAdjust, lightnessAdjust) {
  h = (h + hueAdjust) % 360;
  if (h < 0) h += 360;
  s = Math.max(0, Math.min(1, s * saturationAdjust));
  v = Math.max(0, Math.min(1, v * lightnessAdjust));
  return [h, s, v];
}
function hsvStringToColor(hsvStr) {
  const hsvMatch = hsvStr.match(/hsv\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (hsvMatch) {
    const h = parseInt(hsvMatch[1], 10);
    const s = parseInt(hsvMatch[2], 10) / 100;
    const v = parseInt(hsvMatch[3], 10) / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    return {
      r: r + m,
      g: g + m,
      b: b + m,
      a: 1
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function presetToJsonString(presetName) {
  if (presetName === "custom") {
    return JSON.stringify([
      ["hsv(0, 0%, 0%)", 0],
      ["hsv(0, 0%, 100%)", 1]
    ]);
  }
  const preset = PRESETS[presetName];
  if (!preset) {
    return JSON.stringify([
      ["hsv(0, 0%, 0%)", 0],
      ["hsv(0, 0%, 100%)", 1]
    ]);
  }
  const jsonArray = preset.map((stop) => [
    colorToHsvString(stop.color),
    stop.position
  ]);
  return JSON.stringify(jsonArray);
}
function parseColorStopsJson(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return getDefaultColorStops();
    const colorStops = parsed.map(([colorStr, position]) => ({
      color: hsvStringToColor(colorStr),
      position
    }));
    return colorStops;
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return getDefaultColorStops();
  }
}
function getDefaultColorStops() {
  return [
    { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
  ];
}
var gradientMap = definePlugin({
  id: "gradient-map",
  title: t20("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      preset: {
        type: "string",
        enum: ["custom", "blackAndWhite", "sepia", "duotone", "rainbow"],
        default: "custom"
      },
      colorStops: {
        type: "string",
        default: JSON.stringify([
          ["hsv(0, 0%, 0%)", 0],
          ["hsv(0, 0%, 100%)", 1]
        ])
      },
      strength: {
        type: "real",
        default: 100
      }
    },
    onEditParameters: (params) => {
      if (params.preset !== "custom" && PRESETS[params.preset]) {
        return {
          ...params,
          colorStops: presetToJsonString(params.preset)
        };
      }
      try {
        const colorStops = parseColorStopsJson(params.colorStops);
        const sortedJsonStr = JSON.stringify(
          colorStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position
          ])
        );
        return {
          ...params,
          colorStops: sortedJsonStr
        };
      } catch (e) {
        return params;
      }
    },
    onAdjustColors: (params, adjustColor) => {
      try {
        const colorStops = parseColorStopsJson(params.colorStops);
        const adjustedColorStops = colorStops.map((stop) => ({
          color: adjustColor(stop.color),
          position: stop.position
        }));
        const adjustedJsonStr = JSON.stringify(
          adjustedColorStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position
          ])
        );
        return {
          ...params,
          colorStops: adjustedJsonStr
        };
      } catch (e) {
        return params;
      }
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      if (paramsA.preset !== paramsB.preset) {
        return t22 < 0.5 ? paramsA : paramsB;
      }
      try {
        const stopsA = parseColorStopsJson(paramsA.colorStops);
        const stopsB = parseColorStopsJson(paramsB.colorStops);
        const minLength = Math.min(stopsA.length, stopsB.length);
        const interpolatedStops = [...stopsA];
        for (let i = 0; i < minLength; i++) {
          interpolatedStops[i] = {
            color: {
              r: lerp(stopsA[i].color.r, stopsB[i].color.r, t22),
              g: lerp(stopsA[i].color.g, stopsB[i].color.g, t22),
              b: lerp(stopsA[i].color.b, stopsB[i].color.b, t22),
              a: lerp(stopsA[i].color.a, stopsB[i].color.a, t22)
            },
            position: lerp(stopsA[i].position, stopsB[i].position, t22)
          };
        }
        const interpolatedJsonStr = JSON.stringify(
          interpolatedStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position
          ])
        );
        return {
          preset: t22 < 0.5 ? paramsA.preset : paramsB.preset,
          colorStops: interpolatedJsonStr
        };
      } catch (e) {
        return t22 < 0.5 ? paramsA : paramsB;
      }
    },
    renderUI: (params, { setParam, useStateObject }) => {
      const colorStops = parseColorStopsJson(params.colorStops);
      const [colorAdjustState, setColorAdjustState] = useStateObject({
        hueAdjust: 0,
        saturationAdjust: 1,
        lightnessAdjust: 1
      });
      const handlePresetChange = (e) => {
        const selectedPreset = e.value;
        const jsonStr = presetToJsonString(selectedPreset);
        setParam({ preset: selectedPreset, colorStops: jsonStr });
      };
      const handleJsonChange = (e) => {
        try {
          JSON.parse(e.value);
          setParam({ colorStops: e.value, preset: "custom" });
        } catch (err) {
          console.error("Invalid JSON:", err);
        }
      };
      const handleHueChange = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          hueAdjust: e.value
        });
      };
      const handleSaturationChange = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          saturationAdjust: e.value
        });
      };
      const handleLightnessChange = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          lightnessAdjust: e.value
        });
      };
      const handleColorStopColorChange = (index) => (e) => {
        const newStops = [...colorStops];
        newStops[index] = { ...colorStops[index], color: e.value };
        const sortedStops = newStops.sort((a, b) => a.position - b.position);
        const jsonStr = JSON.stringify(
          sortedStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };
      const handleColorStopPositionChange = (index) => (e) => {
        const newStops = [...colorStops];
        newStops[index] = { ...colorStops[index], position: e.value };
        const jsonStr = JSON.stringify(
          newStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };
      const handleColorStopRemove = (index) => () => {
        if (colorStops.length <= 2) return;
        const newStops = [...colorStops];
        newStops.splice(index, 1);
        const jsonStr = JSON.stringify(
          newStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };
      const handleAddColorStop = () => {
        let newPosition = 0.5;
        if (colorStops.length >= 2) {
          let maxGap = 0;
          let gapPosition = 0.5;
          for (let i = 0; i < colorStops.length - 1; i++) {
            const gap = colorStops[i + 1].position - colorStops[i].position;
            if (gap > maxGap) {
              maxGap = gap;
              gapPosition = colorStops[i].position + gap / 2;
            }
          }
          newPosition = gapPosition;
        }
        const newColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
        const newStop = { color: newColor, position: newPosition };
        const newStops = [...colorStops, newStop].sort(
          (a, b) => a.position - b.position
        );
        const jsonStr = JSON.stringify(
          newStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };
      const handleSortByPosition = () => {
        const sortedStops = [...colorStops].sort(
          (a, b) => a.position - b.position
        );
        const jsonStr = JSON.stringify(
          sortedStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };
      const handleApplyAdjustments = () => {
        const { hueAdjust, saturationAdjust, lightnessAdjust } = colorAdjustState;
        try {
          const parsed = JSON.parse(params.colorStops);
          if (!Array.isArray(parsed)) return;
          const adjustedStops = parsed.map(([colorStr, position]) => {
            const hsvMatch = colorStr.match(
              /hsv\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/
            );
            if (!hsvMatch) return [colorStr, position];
            const h = parseInt(hsvMatch[1], 10);
            const s = parseInt(hsvMatch[2], 10) / 100;
            const v = parseInt(hsvMatch[3], 10) / 100;
            const [newH, newS, newV] = adjustHsv(
              h,
              s,
              v,
              hueAdjust,
              saturationAdjust,
              lightnessAdjust
            );
            const newColorStr = `hsv(${Math.round(newH)}, ${Math.round(
              newS * 100
            )}%, ${Math.round(newV * 100)}%)`;
            return [newColorStr, position];
          });
          const newJsonStr = JSON.stringify(adjustedStops);
          setColorAdjustState({
            hueAdjust: 0,
            saturationAdjust: 1,
            lightnessAdjust: 1
          });
          setParam({
            colorStops: newJsonStr,
            preset: "custom"
          });
        } catch (err) {
          console.error("Failed to apply color adjustments:", err);
        }
      };
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t20("preset") }),
          ui.select({
            key: "preset",
            value: params.preset,
            options: [
              { label: t20("custom"), value: "custom" },
              { label: t20("blackAndWhite"), value: "blackAndWhite" },
              { label: t20("sepia"), value: "sepia" },
              { label: t20("duotone"), value: "duotone" },
              { label: t20("rainbow"), value: "rainbow" }
            ],
            onChange: handlePresetChange
          })
        ]),
        ui.separator(),
        // Strength slider (0-100%)
        ui.group({ direction: "col" }, [
          ui.text({ text: t20("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              dataType: "float",
              min: 0,
              max: 100,
              value: params.strength,
              key: "strength"
            }),
            ui.numberInput({
              dataType: "float",
              min: 0,
              max: 100,
              value: params.strength,
              key: "strength"
            })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t20("jsonEdit") }),
          ui.textInput({
            value: params.colorStops,
            onChange: handleJsonChange
          })
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t20("colorStops") }),
          ...colorStops.map(
            (stop, index) => ui.group({ direction: "row" }, [
              ui.colorInput({
                value: stop.color,
                onChange: handleColorStopColorChange(index)
              }),
              ui.text({ text: t20("position") }),
              ui.slider({
                dataType: "float",
                min: 0,
                max: 1,
                value: stop.position,
                onChange: handleColorStopPositionChange(index)
              }),
              ui.numberInput({
                dataType: "float",
                min: 0,
                max: 1,
                value: stop.position,
                onChange: handleColorStopPositionChange(index)
              }),
              ui.button({
                text: "\xD7",
                disabled: colorStops.length <= 2,
                onClick: handleColorStopRemove(index)
              })
            ])
          ),
          ui.button({
            text: t20("addStop"),
            onClick: handleAddColorStop
          }),
          ui.button({
            text: t20("sortByPosition"),
            onClick: handleSortByPosition
          })
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t20("colorAdjustment") }),
          // Hue adjustment slider (-180 to +180 degrees)
          ui.group({ direction: "row" }, [
            ui.text({ text: t20("hue") }),
            ui.slider({
              dataType: "int",
              min: -180,
              max: 180,
              value: colorAdjustState.hueAdjust,
              onChange: handleHueChange
            }),
            ui.numberInput({
              dataType: "int",
              min: -180,
              max: 180,
              value: colorAdjustState.hueAdjust,
              onChange: handleHueChange
            })
          ]),
          // Saturation adjustment slider (0 to 2)
          ui.group({ direction: "row" }, [
            ui.text({ text: t20("saturation") }),
            ui.slider({
              dataType: "float",
              min: 0,
              max: 2,
              value: colorAdjustState.saturationAdjust,
              onChange: handleSaturationChange
            }),
            ui.numberInput({
              dataType: "float",
              min: 0,
              max: 2,
              value: colorAdjustState.saturationAdjust,
              onChange: handleSaturationChange
            })
          ]),
          // Lightness adjustment slider (0 to 2)
          ui.group({ direction: "row" }, [
            ui.text({ text: t20("lightness") }),
            ui.slider({
              dataType: "float",
              min: 0,
              max: 2,
              value: colorAdjustState.lightnessAdjust,
              onChange: handleLightnessChange
            }),
            ui.numberInput({
              dataType: "float",
              min: 0,
              max: 2,
              value: colorAdjustState.lightnessAdjust,
              onChange: handleLightnessChange
            })
          ]),
          // Apply button
          ui.button({
            text: t20("apply"),
            onClick: handleApplyAdjustments
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Gradient Map)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              colorStopCount: i32,
              strength: f32,
            }

            struct ColorStop {
              color: vec4f,
              position: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var<storage, read> colorStops: array<ColorStop>;

            ${includeOklchMix()}

            fn getLuminance(color: vec3f) -> f32 {
              // Standard luminance calculation (Rec. 709 coefficients)
              return dot(color, vec3f(0.2126, 0.7152, 0.0722));
            }

            fn getGradientColor(luminance: f32) -> vec4f {
              // Handle edge cases
              if (params.colorStopCount <= 0) {
                return vec4f(luminance, luminance, luminance, 1.0);
              }
              if (params.colorStopCount == 1) {
                return colorStops[0].color;
              }

              // Find the two color stops to interpolate between
              var lowerIndex = 0;
              var upperIndex = 1;

              for (var i = 1; i < params.colorStopCount; i++) {
                if (colorStops[i].position <= luminance) {
                  lowerIndex = i;
                  upperIndex = min(i + 1, params.colorStopCount - 1);
                }
              }

              // Special case: luminance is below first stop
              if (luminance <= colorStops[0].position) {
                return colorStops[0].color;
              }

              // Special case: luminance is above last stop
              if (luminance >= colorStops[params.colorStopCount - 1].position) {
                return colorStops[params.colorStopCount - 1].color;
              }

              // Interpolate between the two color stops
              let lowerStop = colorStops[lowerIndex];
              let upperStop = colorStops[upperIndex];

              let range = upperStop.position - lowerStop.position;
              if (range <= 0.0) {
                return lowerStop.color;
              }

              let factor = (luminance - lowerStop.position) / range;
              // Use Oklch color space interpolation for more perceptually uniform results
              return mixOklchVec4(lowerStop.color, upperStop.color, factor);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Sample the original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Calculate luminance from RGB
              let luminance = getLuminance(originalColor.rgb);

              // Get color from gradient map
              let gradientColor = getGradientColor(luminance);

              // Apply strength (mix between original and gradient mapped color)
              let mixStrength = params.strength / 100.0; // Convert 0-100% to 0-1
              var finalColor = originalColor; // Initialize with original color

              if (mixStrength >= 1.0) {
                // Full strength - use gradient color directly
                finalColor = vec4f(gradientColor.rgb, originalColor.a);
              } else if (mixStrength <= 0.0) {
                // Zero strength - use original color (already set)
              } else {
                // Mix colors using Oklch interpolation for better results
                finalColor = vec4f(
                  mixOklch(originalColor.rgb, gradientColor.rgb, mixStrength),
                  originalColor.a
                );
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Gradient Map Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions20(code);
          const pipeline = device.createComputePipeline({
            label: "Gradient Map Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Gradient Map", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const bufferInputWidth = imgData.width, bufferInputHeight = imgData.height;
      const colorStops = parseColorStopsJson(params.colorStops).sort(
        (a, b) => a.position - b.position
      );
      const texture = device.createTexture({
        label: "Gradient Map Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Gradient Map Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Gradient Map Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView20(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Gradient Map Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        colorStopCount: colorStops.length,
        strength: params.strength
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const colorStopData = new Float32Array(colorStops.length * 8);
      for (let i = 0; i < colorStops.length; i++) {
        const stop = colorStops[i];
        const baseIndex = i * 8;
        colorStopData[baseIndex] = stop.color.r;
        colorStopData[baseIndex + 1] = stop.color.g;
        colorStopData[baseIndex + 2] = stop.color.b;
        colorStopData[baseIndex + 3] = stop.color.a;
        colorStopData[baseIndex + 4] = stop.position;
      }
      const colorStopBuffer = device.createBuffer({
        label: "Gradient Map Color Stops Buffer",
        size: colorStopData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(colorStopBuffer, 0, colorStopData);
      const bindGroup = device.createBindGroup({
        label: "Gradient Map Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          },
          {
            binding: 4,
            resource: { buffer: colorStopBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Gradient Map Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Gradient Map Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/husky.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions21,
  makeStructuredView as makeStructuredView21
} from "npm:webgpu-utils";
var t21 = createTranslator({
  en: {
    title: "Blur & Bleed Effect",
    direction: "Direction",
    angle: "Angle",
    horizontalEnabled: "Horizontal Enabled",
    verticalEnabled: "Vertical Enabled",
    blurIntensity: "Blur Intensity",
    bleedIntensity: "Bleed Intensity",
    randomSeed: "Random Seed",
    maxOffset: "Maximum Offset"
  },
  ja: {
    title: "\u306B\u3058\u307F\u30FB\u304B\u3059\u308C\u30A8\u30D5\u30A7\u30AF\u30C8",
    direction: "\u65B9\u5411",
    angle: "\u89D2\u5EA6",
    horizontalEnabled: "\u6A2A\u65B9\u5411\u6709\u52B9\u5316",
    verticalEnabled: "\u7E26\u65B9\u5411\u6709\u52B9\u5316",
    blurIntensity: "\u304B\u3059\u308C\u5F37\u5EA6",
    bleedIntensity: "\u306B\u3058\u307F\u5F37\u5EA6",
    randomSeed: "\u30E9\u30F3\u30C0\u30E0\u30B7\u30FC\u30C9",
    maxOffset: "\u6700\u5927\u30AA\u30D5\u30BB\u30C3\u30C8"
  }
});
var husky = definePlugin({
  id: "husky-effect-v1",
  title: t21("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      angle: {
        type: "real",
        default: 0
      },
      horizontalEnabled: {
        type: "bool",
        default: true
      },
      verticalEnabled: {
        type: "bool",
        default: true
      },
      blurIntensity: {
        type: "real",
        default: 0.5
      },
      bleedIntensity: {
        type: "real",
        default: 0.5
      },
      maxOffset: {
        type: "real",
        default: 10
      },
      randomSeed: {
        type: "real",
        default: 0.5
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        angle: Math.max(0, Math.min(360, params.angle)),
        blurIntensity: Math.max(0, Math.min(1, params.blurIntensity)),
        bleedIntensity: Math.max(0, Math.min(1, params.bleedIntensity)),
        maxOffset: Math.max(0, Math.min(50, params.maxOffset)),
        randomSeed: Math.max(0, Math.min(1, params.randomSeed))
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        angle: params.angle,
        horizontalEnabled: params.horizontalEnabled,
        verticalEnabled: params.verticalEnabled,
        blurIntensity: params.blurIntensity,
        bleedIntensity: params.bleedIntensity,
        maxOffset: params.maxOffset * scaleFactor,
        randomSeed: params.randomSeed
      };
    },
    onInterpolate: (paramsA, paramsB, t22) => {
      return {
        angle: lerp(paramsA.angle, paramsB.angle, t22),
        horizontalEnabled: t22 < 0.5 ? paramsA.horizontalEnabled : paramsB.horizontalEnabled,
        verticalEnabled: t22 < 0.5 ? paramsA.verticalEnabled : paramsB.verticalEnabled,
        blurIntensity: lerp(paramsA.blurIntensity, paramsB.blurIntensity, t22),
        bleedIntensity: lerp(paramsA.bleedIntensity, paramsB.bleedIntensity, t22),
        maxOffset: lerp(paramsA.maxOffset, paramsB.maxOffset, t22),
        randomSeed: lerp(paramsA.randomSeed, paramsB.randomSeed, t22)
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t21("direction") }),
          ui.group({ direction: "col" }, [
            ui.text({ text: t21("angle") }),
            ui.group({ direction: "row" }, [
              ui.slider({ key: "angle", dataType: "float", min: 0, max: 360, value: params.angle }),
              ui.numberInput({ key: "angle", dataType: "float", value: params.angle })
            ])
          ]),
          ui.group({ direction: "row" }, [
            ui.checkbox({ key: "horizontalEnabled", value: params.horizontalEnabled, label: t21("horizontalEnabled") }),
            ui.checkbox({ key: "verticalEnabled", value: params.verticalEnabled, label: t21("verticalEnabled") })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t21("blurIntensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "blurIntensity", dataType: "float", min: 0, max: 1, value: params.blurIntensity }),
            ui.numberInput({ key: "blurIntensity", dataType: "float", value: params.blurIntensity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t21("bleedIntensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bleedIntensity", dataType: "float", min: 0, max: 1, value: params.bleedIntensity }),
            ui.numberInput({ key: "bleedIntensity", dataType: "float", value: params.bleedIntensity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t21("maxOffset") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "maxOffset", dataType: "float", min: 0, max: 50, value: params.maxOffset }),
            ui.numberInput({ key: "maxOffset", dataType: "float", value: params.maxOffset })
          ])
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t21("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "randomSeed", dataType: "float", min: 0, max: 1, value: params.randomSeed }),
            ui.numberInput({ key: "randomSeed", dataType: "float", value: params.randomSeed })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Husky Effect)" }
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              angle: f32,
              horizontalEnabled: i32,
              verticalEnabled: i32,
              blurIntensity: f32,
              bleedIntensity: f32,
              maxOffset: f32,
              randomSeed: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn random(co: vec2f) -> f32 {
              return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            fn noise(p: vec2f, seed: f32) -> f32 {
              let pi = floor(p);
              let pf = fract(p);

              let seedVec = vec2f(seed, seed * 1.374);

              let n00 = random(pi + seedVec);
              let n10 = random(pi + vec2f(1.0, 0.0) + seedVec);
              let n01 = random(pi + vec2f(0.0, 1.0) + seedVec);
              let n11 = random(pi + vec2f(1.0, 1.0) + seedVec);

              let u = pf * pf * (3.0 - 2.0 * pf);

              let nx0 = mix(n00, n10, u.x);
              let nx1 = mix(n01, n11, u.x);

              return mix(nx0, nx1, u.y);
            }

            fn fractalNoise(p: vec2f, seed: f32) -> f32 {
              var value = 0.0;
              var amplitude = 0.5;
              var frequency = 1.0;
              let octaves = 4;
              let lacunarity = 2.0;
              let persistence = 0.5;

              for (var i = 0; i < octaves; i = i + 1) {
                value = value + noise(p * frequency, seed + f32(i) * 13.371) * amplitude;
                amplitude = amplitude * persistence;
                frequency = frequency * lacunarity;
              }

              return value;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              // \u51E6\u7406\u7BC4\u56F2\u30C1\u30A7\u30C3\u30AF
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // \u30AA\u30EA\u30B8\u30CA\u30EB\u306E\u8272\u3092\u53D6\u5F97
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              if (params.blurIntensity <= 0.0 && params.bleedIntensity <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let angleRad = params.angle * 3.14159265359 / 180.0;

              let dirX = cos(angleRad);
              let dirY = sin(angleRad);

              var horizEnabled = 0.0;
              var vertEnabled = 0.0;

              if (params.horizontalEnabled != 0) {
                horizEnabled = 1.0;
              }

              if (params.verticalEnabled != 0) {
                vertEnabled = 1.0;
              }

              let direction = vec2f(
                dirX * horizEnabled,
                dirY * vertEnabled
              );

              let noiseScale = 3.0;
              let noiseSeed = params.randomSeed * 100.0;

              let noiseUV = texCoord * noiseScale;

              var finalColor = originalColor;

              if (params.blurIntensity > 0.0) {
                let blurNoiseValue = fractalNoise(noiseUV, noiseSeed) * 2.0 - 1.0;
                let offsetScale = params.maxOffset * params.dpiScale * 0.5;  // \u52B9\u679C\u3092\u5927\u304D\u304F
                let blurOffset = direction * blurNoiseValue * params.blurIntensity * offsetScale;

                var blurredColor = vec4f(0.0, 0.0, 0.0, 0.0);
                var totalWeight = 0.0;
                let sampleCount = 6;

                for (var i = 0; i < sampleCount; i = i + 1) {
                  let t = f32(i) / f32(sampleCount - 1);
                  let weight = 1.0 - abs(t - 0.5) * 2.0;

                  let sampleOffset = blurOffset * (t - 0.5) * 2.0;
                  let sampleCoord = texCoord + sampleOffset / dims;

                  var validSample = false;
                  if (sampleCoord.x >= 0.0 &&
                      sampleCoord.x <= 1.0 &&
                      sampleCoord.y >= 0.0 &&
                      sampleCoord.y <= 1.0) {
                    validSample = true;
                  }

                  if (validSample) {
                    let sampleColor = textureSampleLevel(
                      inputTexture,
                      textureSampler,
                      sampleCoord,
                      0.0
                    );

                    blurredColor = blurredColor + sampleColor * weight;
                    totalWeight = totalWeight + weight;
                  }
                }

                if (totalWeight > 0.0) {
                  blurredColor = blurredColor / totalWeight;
                  finalColor = blurredColor;
                }
              }

              if (params.bleedIntensity > 0.0) {
                let redNoiseValue = fractalNoise(noiseUV + vec2f(1.234, 5.678), noiseSeed);
                let greenNoiseValue = fractalNoise(noiseUV + vec2f(4.321, 8.765), noiseSeed + 10.0);
                let blueNoiseValue = fractalNoise(noiseUV + vec2f(7.890, 1.234), noiseSeed + 20.0);

                let redOffset = (redNoiseValue * 2.0 - 1.0) * params.bleedIntensity;
                let greenOffset = (greenNoiseValue * 2.0 - 1.0) * params.bleedIntensity * 0.7;
                let blueOffset = (blueNoiseValue * 2.0 - 1.0) * params.bleedIntensity;

                let offsetScale = params.maxOffset * params.dpiScale * 0.4;  // \u52B9\u679C\u3092\u5927\u304D\u304F

                let redTexCoord = texCoord + direction * redOffset * offsetScale / dims;
                let greenTexCoord = texCoord + direction * greenOffset * offsetScale / dims;
                let blueTexCoord = texCoord + direction * blueOffset * offsetScale / dims;

                var validRedSample = false;
                if (redTexCoord.x >= 0.0 &&
                    redTexCoord.x <= 1.0 &&
                    redTexCoord.y >= 0.0 &&
                    redTexCoord.y <= 1.0) {
                  validRedSample = true;
                }

                var validGreenSample = false;
                if (greenTexCoord.x >= 0.0 &&
                    greenTexCoord.x <= 1.0 &&
                    greenTexCoord.y >= 0.0 &&
                    greenTexCoord.y <= 1.0) {
                  validGreenSample = true;
                }

                var validBlueSample = false;
                if (blueTexCoord.x >= 0.0 &&
                    blueTexCoord.x <= 1.0 &&
                    blueTexCoord.y >= 0.0 &&
                    blueTexCoord.y <= 1.0) {
                  validBlueSample = true;
                }

                var redValue = finalColor.r;
                var greenValue = finalColor.g;
                var blueValue = finalColor.b;

                if (validRedSample) {
                  let redSample = textureSampleLevel(inputTexture, textureSampler, redTexCoord, 0.0);
                  redValue = redSample.r;
                }

                if (validGreenSample) {
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, greenTexCoord, 0.0);
                  greenValue = greenSample.g;
                }

                if (validBlueSample) {
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueTexCoord, 0.0);
                  blueValue = blueSample.b;
                }

                finalColor = vec4f(redValue, greenValue, blueValue, finalColor.a);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Husky Effect Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions21(code);
          const pipeline = device.createComputePipeline({
            label: "Husky Effect Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Husky Effect V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest"
      });
      const uniformValues = makeStructuredView21(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        angle: params.angle,
        horizontalEnabled: params.horizontalEnabled ? 1 : 0,
        verticalEnabled: params.verticalEnabled ? 1 : 0,
        blurIntensity: params.blurIntensity,
        bleedIntensity: params.bleedIntensity,
        diffusionRadius: params.diffusionRadius,
        inkAbsorption: params.inkAbsorption,
        edgeEnhance: params.edgeEnhance,
        randomSeed: params.randomSeed
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
          },
          {
            binding: 2,
            resource: sampler
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Husky Effect Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/main.ts
var EFFECTS_DIR = new URL(toFileUrl2(join2(homedir(), ".ai-deno/effects")));
var allPlugins = [
  brushStroke,
  chromaticAberration,
  coastic,
  comicTone,
  dataMosh,
  directionalBlur,
  dithering,
  downsampler,
  fluidDistortion,
  gaussianBlur,
  glitch,
  gradientMap,
  halftone,
  husky,
  // innerGlow,
  kaleidoscope,
  kirakiraBlur,
  outline,
  paperTexture,
  // pixelSort,
  selectiveColorCorrection,
  testBlueFill,
  vhsInterlace,
  waveDistortion
];
var effectInits = /* @__PURE__ */ new Map();
var allEffectPlugins = Object.fromEntries(
  allPlugins.filter((p) => !!p.liveEffect).map((p) => [p.id, p])
);
try {
  await Promise.all(
    Object.values(allEffectPlugins).map(
      async (effect) => {
        return retry(6, async () => {
          var _a, _b;
          try {
            effectInits.set(
              effect,
              await ((_b = (_a = effect.liveEffect).initLiveEffect) == null ? void 0 : _b.call(_a)) ?? {}
            );
          } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            throw new Error(
              `[effect: ${effect.id}] Failed to initialize effect`,
              {
                cause: e
              }
            );
          }
        });
      }
    )
  );
} catch (e) {
  console.error(e);
  if (e instanceof AggregateError) {
    const _e = e;
    const logs = _e.errors.map((e2) => `${e2.message}`).join("\n");
    _AI_DENO_.op_ai_alert("[AiDeno] Failed to initialize effects\n\n" + logs);
  }
}
async function loadEffects() {
  ensureDirSync(EFFECTS_DIR);
  logger.log("loadEffects", `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`);
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false
    })
  ];
  logger.log("loadEffects metas", metas);
  await Promise.allSettled(
    metas.map((dir) => {
      logger.log("dir", dir);
    })
  );
}
function getLiveEffects() {
  logger.log("allEffectPlugins", allEffectPlugins);
  return Object.values(allEffectPlugins).map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version
  }));
}
var nodeState = null;
function getEffectViewNode(effectId, params) {
  var _a, _b;
  const effect = findEffect(effectId);
  if (!effect) return null;
  params = getParams(effectId, params);
  params = ((_b = (_a = effect.liveEffect).onEditParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
  let localNodeState = null;
  const setParam = (update) => {
    if (!localNodeState) {
      throw new Error("Unpextected null localNodeState");
    }
    const clone = structuredClone(localNodeState.latestParams);
    let patch = null;
    if (typeof update === "function") {
      patch = update(Object.freeze(clone));
    } else {
      patch = update;
    }
    const next = Object.assign({}, localNodeState.latestParams, patch);
    console.log({ clone, patch });
    localNodeState.latestParams = editLiveEffectParameters(effectId, next);
  };
  const useStateObject = (initialState) => {
    if (!localNodeState) {
      throw new Error("Unpextected null localNodeState");
    }
    localNodeState.state ??= initialState;
    const setState = (update) => {
      if (!localNodeState) {
        throw new Error("Unpextected null localNodeState");
      }
      if (typeof update === "function") {
        update = update(Object.freeze(localNodeState.state));
      }
      localNodeState.state = Object.assign({}, localNodeState.state, update);
    };
    return [localNodeState.state, setState];
  };
  try {
    nodeState = localNodeState = {
      effectId: effect.id,
      nodeMap: null,
      latestParams: params,
      state: void 0
    };
    let tree = effect.liveEffect.renderUI(params, { setParam, useStateObject });
    tree = ui.group({ direction: "col" }, [
      tree,
      ui.group({ direction: "row" }, [
        ui.separator(),
        ui.text({
          size: "sm",
          text: `AiDeno: ${_AI_DENO_.op_ai_get_plugin_version()} Plugin: ${effect.version.major}.${effect.version.minor}`
        })
      ])
    ]);
    const nodeMap = attachNodeIds(tree);
    localNodeState.nodeMap = nodeMap;
    return tree;
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
function editLiveEffectParameters(id, params) {
  var _a, _b;
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  return ((_b = (_a = effect.liveEffect).onEditParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
}
async function editLiveEffectFireCallback(effectId, event, params) {
  const effect = findEffect(effectId);
  const node = nodeState == null ? void 0 : nodeState.nodeMap.get(event.nodeId);
  if (!effect || !node || !nodeState || nodeState.effectId !== effectId) {
    return {
      updated: false
    };
  }
  logger.log("Fire event callback", { effectId, event, params });
  nodeState.latestParams = structuredClone(params);
  const current = params;
  switch (event.type) {
    case "click": {
      if ("onClick" in node && typeof node.onClick === "function")
        await node.onClick({ type: "click" });
      break;
    }
    case "change": {
      if ("onChange" in node && typeof node.onChange === "function") {
        await node.onChange({
          type: "change",
          value: event.value
        });
      }
    }
  }
  if (isEqual(current, nodeState.latestParams)) {
    return {
      updated: false
    };
  }
  return {
    updated: true,
    params: nodeState.latestParams,
    tree: getEffectViewNode(effectId, nodeState.latestParams)
  };
}
function attachNodeIds(node) {
  const nodeMap = /* @__PURE__ */ new Map();
  const traverseNode = (node2, nodeId = "") => {
    if (node2 == null) return;
    node2.nodeId = nodeId;
    nodeMap.set(nodeId, node2);
    if (node2.type === "group") {
      node2.children.forEach((child, index) => {
        if (child == null) return;
        traverseNode(child, `${node2.nodeId}.${index}-${child.type}`);
      });
    }
  };
  traverseNode(node, ".root");
  return nodeMap;
}
function liveEffectAdjustColors(id, params, adjustCallback) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = structuredClone(getParams(id, params));
  const result = effect.liveEffect.onAdjustColors(params, adjustCallback);
  return {
    hasChanged: !isEqual(result, params),
    params: result
  };
}
function liveEffectScaleParameters(id, params, scaleFactor) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  const result = effect.liveEffect.onScaleParams(params, scaleFactor);
  return {
    hasChanged: result != null,
    params: result ?? params
  };
}
function liveEffectInterpolate(id, params, params2, t22) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  params2 = getParams(id, params2);
  return effect.liveEffect.onInterpolate(params, params2, t22);
}
var goLiveEffect = async (id, params, env, width, height, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultParams = getDefaultValus(id);
  const init = effectInits.get(effect);
  if (!init) {
    logger.error("Effect not initialized", id);
    return null;
  }
  logger.log("goLiveEffect", { id, input: { width, height }, env, params });
  logger.log("--- LiveEffect Logs ---");
  try {
    const input = {
      data,
      width,
      height
    };
    const result = await effect.liveEffect.goLiveEffect(
      init,
      {
        ...defaultParams,
        ...params
      },
      input,
      {
        ...env
      }
    );
    if (typeof result.width !== "number" || typeof result.height !== "number" || !(result.data instanceof Uint8ClampedArray)) {
      throw new Error("Invalid result from goLiveEffect");
    }
    return result;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
function getParams(effectId, state) {
  const effect = findEffect(effectId);
  if (!effect) return null;
  const defaultValues2 = getDefaultValus(effectId);
  return {
    ...defaultValues2,
    ...state
  };
}
var getDefaultValus = (effectId) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.liveEffect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default)
    ])
  );
};
function findEffect(id) {
  const effect = allEffectPlugins[id];
  if (!effect) logger.error(`Effect not found: ${id}`);
  return effect;
}
async function retry(maxRetries, fn) {
  const errors = [];
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (e) {
      errors.push(e);
      retries++;
    }
  }
  throw new AggregateError(errors, "All retries failed");
}
export {
  editLiveEffectFireCallback,
  editLiveEffectParameters,
  getEffectViewNode,
  getLiveEffects,
  goLiveEffect,
  liveEffectAdjustColors,
  liveEffectInterpolate,
  liveEffectScaleParameters,
  loadEffects
};
