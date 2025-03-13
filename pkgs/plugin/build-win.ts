#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

/**
 * Windows Build Script for AiDenoPlugin
 *
 * This script automates the build process for the AiDenoPlugin on Windows.
 * It handles dependency checks, compilation, and resource linking.
 *
 * Usage:
 *   deno run --allow-run --allow-read --allow-write --allow-env build-win.ts [--release]
 *
 * Options:
 *   --release     Build in release mode (default is debug)
 *   --clean       Clean build artifacts before building
 *   --help        Show this help message
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import { ensureDir, exists } from "https://deno.land/std/fs/mod.ts";

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["release", "clean", "help"],
  default: { release: false, clean: false, help: false },
});

// Show help message if requested
if (args.help) {
  console.log(`
Windows Build Script for AiDenoPlugin

Usage:
  deno run --allow-run --allow-read --allow-write --allow-env build-win.ts [options]

Options:
  --release     Build in release mode (default is debug)
  --clean       Clean build artifacts before building
  --help        Show this help message
  `);
  Deno.exit(0);
}

// Configuration
const config = {
  buildMode: args.release ? "Release" : "Debug",
  pluginName: "IllustratorDeno.aip",
  buildDir: args.release ? "output/win/release" : "output/win/debug",
  tempDir: "build/temp",
  sourceDirs: ["Source", "deps/imgui", "deps/json", "deps/format"],
  sdkRelativePath: "../../illustrator-sdk",
  aiDenoRelativePath: "../ai-deno",
  vcVars64Path:
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat",
};

// Ensure we're in the correct directory (pkgs/plugin)
const currentDir = Deno.cwd();
const isInPluginDir = await exists(path.join(currentDir, "Source"));
if (!isInPluginDir) {
  console.error(
    "Error: This script must be run from the pkgs/plugin directory"
  );
  Deno.exit(1);
}

// Create necessary directories
await ensureDir(config.buildDir);
await ensureDir(config.tempDir);
await ensureDir(path.join(config.tempDir, "obj"));

// Clean build artifacts if requested
if (args.clean) {
  console.log(`Cleaning build artifacts in ${config.buildDir}...`);
  try {
    await Deno.remove(config.buildDir, { recursive: true });
    await Deno.remove(config.tempDir, { recursive: true });
    await ensureDir(config.buildDir);
    await ensureDir(config.tempDir);
  } catch (error) {
    console.warn(
      `Warning: Could not clean directories completely: ${error.message}`
    );
  }
}

// Check for required tools and SDKs
console.log("Checking dependencies...");

// Check for MSVC
let hasMSVC = false;
try {
  const process = Deno.run({
    cmd: ["where", "cl.exe"],
    stdout: "null",
    stderr: "null",
  });
  const status = await process.status();
  hasMSVC = status.success;
  process.close();
} catch (_) {
  hasMSVC = false;
}

// Check for Illustrator SDK
const hasSDK = await exists(path.join(currentDir, config.sdkRelativePath));

// Check for Deno binding
const hasDenoBinding = await exists(
  path.join(
    currentDir,
    config.aiDenoRelativePath,
    "target",
    "release",
    "ai_deno.lib"
  )
);

// Report dependency status
console.log(`MSVC C++ Compiler: ${hasMSVC ? "✅ Found" : "❌ Not found"}`);
console.log(`Illustrator SDK: ${hasSDK ? "✅ Found" : "❌ Not found"}`);
console.log(`ai-deno Binding: ${hasDenoBinding ? "✅ Found" : "❌ Not found"}`);

if (!hasMSVC || !hasSDK || !hasDenoBinding) {
  console.error(
    "\nError: Some dependencies are missing. Please check requirements."
  );
  if (!hasMSVC) {
    console.error(
      "  - MSVC Compiler not found. Install Visual Studio with C++ desktop development workload"
    );
    console.error(`  - Try running: "${config.vcVars64Path}"`);
  }
  if (!hasSDK) {
    console.error(
      `  - Illustrator SDK not found. Clone it at ${config.sdkRelativePath}`
    );
  }
  if (!hasDenoBinding) {
    console.error(
      `  - ai-deno binding not found. Build it with: cd ${config.aiDenoRelativePath} && cargo build --release`
    );
  }
  Deno.exit(1);
}

// Build process
console.log(`\nBuilding AiDenoPlugin in ${config.buildMode} mode...`);

// Generate source file list
async function findSourceFiles(
  dir: string,
  extension: string
): Promise<string[]> {
  const result: string[] = [];

  for await (const entry of Deno.readDir(dir)) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory) {
      // Skip node_modules and certain directories
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
        result.push(...(await findSourceFiles(filePath, extension)));
      }
    } else if (entry.isFile && filePath.endsWith(extension)) {
      result.push(filePath);
    }
  }

  return result;
}

// Find all source files
console.log("Finding source files...");
const sourceFiles: string[] = [];

// Add main project source files
for (const dir of config.sourceDirs) {
  sourceFiles.push(...(await findSourceFiles(dir, ".cpp")));
}

// Add SDK source files
const sdkSourceFiles = [
  "samplecode/common/source/AppContext.cpp",
  "samplecode/common/source/Main.cpp",
  "samplecode/common/source/Plugin.cpp",
  "samplecode/common/source/Suites.cpp",
  "samplecode/common/source/IllustratorSDK.cpp",
  "samplecode/common/source/SDKAboutPluginsHelper.cpp",
  "samplecode/common/source/FlashUIController.cpp",
  "samplecode/common/source/SDKPlugPlug.cpp",
  "illustratorapi/illustrator/IAIUnicodeString.cpp",
  "illustratorapi/illustrator/IAIFilePath.cpp",
];

for (const file of sdkSourceFiles) {
  sourceFiles.push(path.join(config.sdkRelativePath, file));
}

// ImGui files
const imguiFiles = [
  "deps/imgui/imgui.cpp",
  "deps/imgui/imgui_draw.cpp",
  "deps/imgui/imgui_tables.cpp",
  "deps/imgui/imgui_widgets.cpp",
  "deps/imgui/misc/cpp/imgui_stdlib.cpp",
];

for (const file of imguiFiles) {
  sourceFiles.push(file);
}

console.log(`Found ${sourceFiles.length} source files to compile`);

// Create batch file for compilation
const batchFilePath = path.join(config.tempDir, "build.bat");
const outputPath = path.join(config.buildDir, config.pluginName);

// Generate include directories
const includeDirs = [
  `"${path.join(config.sdkRelativePath, "illustratorapi", "ate")}"`,
  `"${path.join(config.sdkRelativePath, "illustratorapi", "illustrator")}"`,
  `"${path.join(
    config.sdkRelativePath,
    "illustratorapi",
    "illustrator",
    "actions"
  )}"`,
  `"${path.join(config.sdkRelativePath, "illustratorapi", "pica_sp")}"`,
  `"${path.join(config.sdkRelativePath, "samplecode", "common", "includes")}"`,
  `"${path.join(config.aiDenoRelativePath, "target", "release", "includes")}"`,
  `"deps/metal-cpp"`,
  `"deps/json"`,
  `"deps/format"`,
  `"deps/imgui"`,
  `"Source"`,
];

// Prepare compiler flags
const compilerFlags = [
  "/std:c++20",
  "/EHsc",
  "/MD",
  args.release ? "/O2" : "/Od",
  args.release ? "/DNDEBUG" : "/D_DEBUG",
  "/DWIN64",
  "/DWINDOWS",
  "/D_WINDOWS",
  "/D_USRDLL",
];

// Create batch file content
let batchContent = `@echo off\r\n`;
batchContent += `echo Building AiDenoPlugin in ${config.buildMode} mode...\r\n`;
batchContent += `call "${config.vcVars64Path}"\r\n`;
batchContent += `if %ERRORLEVEL% neq 0 goto error\r\n\r\n`;

// Compile source files
batchContent += `echo Compiling source files...\r\n`;
const objFiles: string[] = [];

for (let i = 0; i < sourceFiles.length; i++) {
  const sourceFile = sourceFiles[i];
  const objFile = path.join(config.tempDir, "obj", `file${i}.obj`);
  objFiles.push(`"${objFile}"`);

  batchContent += `cl.exe ${compilerFlags.join(" ")} ${includeDirs
    .map((dir) => `/I${dir}`)
    .join(" ")} /c "${sourceFile}" /Fo"${objFile}"\r\n`;
  batchContent += `if %ERRORLEVEL% neq 0 goto error\r\n`;
}

// Compile resources
batchContent += `\r\necho Compiling resources...\r\n`;
batchContent += `rc.exe /fo "${path.join(
  config.tempDir,
  "resources.res"
)}" "Resources/Win/HelloWorld.rc"\r\n`;
batchContent += `if %ERRORLEVEL% neq 0 goto error\r\n`;

// Link everything
batchContent += `\r\necho Linking...\r\n`;
batchContent += `link.exe /OUT:"${outputPath}" /DLL /SUBSYSTEM:WINDOWS ${objFiles.join(
  " "
)} "${path.join(config.tempDir, "resources.res")}" "${path.join(
  config.aiDenoRelativePath,
  "target",
  "release",
  "ai_deno.lib"
)}"\r\n`;
batchContent += `if %ERRORLEVEL% neq 0 goto error\r\n`;

// Finish batch file
batchContent += `\r\necho Build completed successfully!\r\n`;
batchContent += `echo Output: ${outputPath}\r\n`;
batchContent += `exit /b 0\r\n\r\n`;
batchContent += `:error\r\n`;
batchContent += `echo Build failed with error code %ERRORLEVEL%\r\n`;
batchContent += `exit /b %ERRORLEVEL%\r\n`;

// Write batch file
await Deno.writeTextFile(batchFilePath, batchContent);

// Execute batch file
console.log("Executing build process...");
const buildProcess = Deno.run({
  cmd: [batchFilePath],
  stdout: "inherit",
  stderr: "inherit",
});

const buildStatus = await buildProcess.status();
buildProcess.close();

if (!buildStatus.success) {
  console.error(`Build failed with code ${buildStatus.code}`);
  Deno.exit(buildStatus.code);
}

console.log("\nBuild completed successfully!");
console.log(`Output: ${outputPath}`);
