const adapter = (await navigator.gpu.requestAdapter())!;

for (let i = 0; i < 10; i++) {
  const device = await adapter.requestDevice();
  console.log(device.lost);
  device.lost.then(() => {
    console.log("Device lost");
  });
}
