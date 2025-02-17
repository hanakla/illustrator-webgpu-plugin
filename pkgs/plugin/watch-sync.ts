import { fromFileUrl } from "jsr:@std/path";
import { debounce } from "jsr:@es-toolkit/es-toolkit";
import { copy } from "jsr:@std/fs";

const AI_BIN =
  "/Applications/Adobe Illustrator 2025/Adobe Illustrator.app/Contents/MacOS/Adobe Illustrator";
const BUILT_AIP = new URL(
  "./output/mac/debug/IllustratorDeno.aip",
  import.meta.url
);
const AIP_DIST = new URL(
  "/Applications/Adobe Illustrator 2025/Plug-ins.localized/IllustratorDeno.aip",
  import.meta.url
);

let currentProcess: Deno.ChildProcess | null = null;

async function main() {
  const watcher = Deno.watchFs(fromFileUrl(BUILT_AIP), { recursive: true });

  console.log(">>> Watching for changes");

  // await restartIllustrator();

  onUpdate({ kind: "any", paths: [] });
  for await (const event of watcher) {
    onUpdate(event);
  }
}

const onUpdate = debounce(async (e: Deno.FsEvent) => {
  const time = new Date().toLocaleString();
  console.log(`>>> Plugin updated (${time}): ${e.kind}`, e.paths);

  try {
    await Deno.remove(AIP_DIST, { recursive: true });
  } catch {}
  await copy(BUILT_AIP, AIP_DIST, { overwrite: true });
  sound();

  restartIllustrator();
}, 1000);

async function restartIllustrator() {
  return;

  // console.log(">>> Restarting Illustrator");

  // if (currentProcess) {
  //   new Deno.Command("kill", { args: [currentProcess.pid.toString()] }).spawn();
  //   currentProcess = null;
  // }

  // const cmd = new Deno.Command("open", {
  //   args: ["--hide", AI_BIN],
  //   // env: Deno.env.toObject(),
  //   // cwd: Deno.cwd(),
  // });

  // currentProcess = cmd.spawn();
}

if (import.meta.main) {
  main();
}

function sound() {
  new Deno.Command("afplay", { args: ["Success 2.m4a"] }).spawn();
}
