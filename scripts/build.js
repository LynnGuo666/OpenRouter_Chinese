"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "src");
const OUTPUT_FILE = path.join(ROOT, "openrouter-zh-cny.user.js");
const MANIFEST_FILE = path.join(SOURCE_ROOT, "manifest.json");
const PACKAGE_FILE = path.join(ROOT, "package.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function buildUserscript() {
  const manifest = readJson(MANIFEST_FILE);
  const { version } = readJson(PACKAGE_FILE);
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("src/manifest.json 必须包含至少一个源码模块");
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 中的版本号无效：${version}`);
  }

  const seen = new Set();
  const source = manifest
    .map((relativeFile) => {
      if (typeof relativeFile !== "string" || !relativeFile.endsWith(".js")) {
        throw new Error(`构建清单包含无效模块：${relativeFile}`);
      }
      if (seen.has(relativeFile)) throw new Error(`构建清单包含重复模块：${relativeFile}`);
      seen.add(relativeFile);
      const absoluteFile = path.resolve(SOURCE_ROOT, relativeFile);
      if (!absoluteFile.startsWith(`${SOURCE_ROOT}${path.sep}`)) {
        throw new Error(`构建模块越过 src 目录：${relativeFile}`);
      }
      if (!fs.existsSync(absoluteFile)) throw new Error(`找不到构建模块：${relativeFile}`);
      return fs.readFileSync(absoluteFile, "utf8");
    })
    .join("")
    .replaceAll("__VERSION__", version);

  if (source.includes("__VERSION__")) throw new Error("版本占位符未完全替换");
  const metadataVersion = source.match(/^\/\/ @version\s+(\S+)$/m)?.[1];
  const runtimeVersion = source.match(/const VERSION = "([^"]+)";/)?.[1];
  if (metadataVersion !== version || runtimeVersion !== version) {
    throw new Error("package、元数据与运行时版本不一致");
  }
  new vm.Script(source, { filename: path.basename(OUTPUT_FILE) });
  return source;
}

function main() {
  const source = buildUserscript();
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : "";
    if (current !== source) {
      console.error("发布脚本已过期，请运行 npm run build");
      process.exitCode = 1;
      return;
    }
    console.log("发布脚本与 src 源码一致");
    return;
  }
  fs.writeFileSync(OUTPUT_FILE, source);
  console.log(`已生成 ${path.relative(ROOT, OUTPUT_FILE)}`);
}

if (require.main === module) main();

module.exports = { buildUserscript };
