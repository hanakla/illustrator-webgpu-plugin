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
    const adapter = await navigator.gpu.requestAdapter(options.adapter);
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
