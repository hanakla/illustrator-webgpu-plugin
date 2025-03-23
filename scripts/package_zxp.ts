import { ensureDir, copy } from "jsr:@std/fs@1.0.14";
import { fromFileUrl, toFileUrl, join } from "jsr:@std/path@1.0.1";

const BASE_PATH = join(import.meta.dirname!, "..");

const AIP_PATH = join(
  BASE_PATH,
  "pkgs/plugin/output/mac/release/AiWebGPUPlugin.aip"
);
const WORKDIR = join(BASE_PATH, "./zxptmp");
const WORKDIR_CONTENTS = join(WORKDIR, "./contents");
const DIST_DIR = join(BASE_PATH, "./dist");

const ZXP_PATH = Deno.args[0];

console.log({
  BASE_PATH: BASE_PATH.toString(),
  AIP_PATH: AIP_PATH.toString(),
  WORKDIR: WORKDIR.toString(),
  WORKDIR_CONTENTS: WORKDIR_CONTENTS.toString(),
  DIST_DIR: DIST_DIR.toString(),
});

if (import.meta.main) {
  console.log("Making a ZXP package...");

  try {
    try {
      await Deno.remove(WORKDIR, { recursive: true });
    } catch (e) {}

    await ensureDir(WORKDIR);
    await ensureDir(WORKDIR_CONTENTS);
    await ensureDir(DIST_DIR);

    console.log("Creating a self-signed certificate...");

    let certGen = await spawn(ZXP_PATH, [
      "-selfSignedCert",
      "JP",
      "Osaka",
      "Hanakla",
      "Hanakla",
      Deno.env.get("ZXP_CERT_PASSWORD")!.slice(0), // null check
      join(WORKDIR, "zxp_cert.p12"),
    ]);

    if (!certGen.success) {
      console.log(new TextDecoder().decode(certGen.stderr));
      throw new Error("Failed to create a self-signed certificate");
    }

    console.log("Creating a ZXP package...");

    await copy(AIP_PATH, join(WORKDIR_CONTENTS, "AiWebGPUPlugin.aip"));

    await copy(
      join(BASE_PATH, "./ai-webgpu.mxi"),
      join(WORKDIR_CONTENTS, "ai-webgpu.mxi")
    );

    let pack = await spawn(ZXP_PATH, [
      // ZXPSignCmd -sign <inputDir> <outputZxp> <p12> <p12Password>
      "-sign",
      WORKDIR_CONTENTS,
      join(DIST_DIR, "ai-webgpu.zxp"),
      join(WORKDIR, "zxp_cert.p12"),
      Deno.env.get("ZXP_CERT_PASSWORD")!.slice(0),
    ]);

    if (!pack.success) {
      console.log(new TextDecoder().decode(pack.stderr));
      throw new Error("Failed to create a ZXP package");
    }

    console.log("Done");
  } catch (e) {
    console.log(e);
  } finally {
    // Deno.remove(new URL("zxptmp", BASE_URL), { recursive: true });
  }
}

function spawn(cmd: string, args: string[]) {
  const c = new Deno.Command(cmd, {
    args,
    stdout: "piped",
  });

  return c.output();
}
