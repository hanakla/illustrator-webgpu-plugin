import { logger } from "../logger.ts";

export async function createGPUDevice<
  T extends (device: GPUDevice) => any | Promise<any>
>(
  options: {
    adapter?: GPURequestAdapterOptions;
    device?: GPUDeviceDescriptor;
  } = {},
  initializer: T
): Promise<
  {
    device: GPUDevice;
  } & Awaited<ReturnType<T>>
> {
  let deviceRef: GPUDevice | null = null;
  let inits: Awaited<ReturnType<T>> | null = null;

  const init = async () => {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
      ...options.adapter,
    });
    if (!adapter) {
      throw new Error("No adapter found");
    }

    const device = await adapter.requestDevice({
      ...options.device,
      requiredLimits: {
        ...options.device?.requiredLimits,
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D!,
      },
    });

    device.addEventListener("uncapturederror", (e) => {
      console.error(e.error);
    });

    // device.lost.then(async () => {
    //   deviceRef = await init();
    // });

    inits = await initializer(device);

    return device;
  };

  deviceRef = await init();

  logger.info("Create GPU Device: ", options.device?.label ?? "<<unnamed>>");

  return new Proxy(
    {},
    {
      get(_, key) {
        if (key === "device") {
          return deviceRef!;
        }
        return Reflect.get(inits!, key);
      },
      has(_, p) {
        return Reflect.has(inits!, p);
      },
    }
  ) as { device: GPUDevice } & Awaited<ReturnType<T>>;
}

export function includeOklchMix() {
  // fn mixOklch(rgbColor1: vec3<f32>, rgbColor2: vec3<f32>, t: f32) -> vec3<f32>;
  // fn mixOklchVec4(rgbColor1: vec4<f32>, rgbColor2: vec4<f32>, t: f32) -> vec4<f32>;
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

      // 色相の補間（最短経路）
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
