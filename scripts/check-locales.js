"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { buildUserscript } = require("./build.js");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT, "openrouter-zh-cny.user.js");

function main() {
  const expectedSource = buildUserscript();
  const currentSource = require("node:fs").readFileSync(OUTPUT_FILE, "utf8");
  assert.equal(currentSource, expectedSource, "发布脚本与源码不一致，请先运行 npm run build");

  delete require.cache[require.resolve(OUTPUT_FILE)];
  const { UI_TRANSLATION_MODULES } = require(OUTPUT_FILE);
  const expectedModules = [
    "navigation",
    "common",
    "home",
    "catalog",
    "details",
    "providers",
    "metrics",
    "benchmarks",
    "rankings",
    "apps",
    "docsShell",
    "docs",
    "sdk",
    "blog",
    "legal",
    "support",
    "marketing",
    "data",
    "product",
    "fusion",
    "footer",
    "accessibility",
  ];
  assert.deepEqual(Object.keys(UI_TRANSLATION_MODULES), expectedModules, "词典模块顺序异常");

  let entryCount = 0;
  for (const [moduleName, entries] of Object.entries(UI_TRANSLATION_MODULES)) {
    assert.ok(Object.isFrozen(entries), `${moduleName} 词典必须冻结`);
    for (const [source, translated] of Object.entries(entries)) {
      assert.ok(source.trim(), `${moduleName} 包含空原文`);
      assert.equal(typeof translated, "string", `${moduleName}.${source} 的译文必须是字符串`);
      assert.ok(translated.trim(), `${moduleName}.${source} 包含空译文`);
      entryCount += 1;
    }
  }
  console.log(`词典校验通过：${expectedModules.length} 个模块，${entryCount} 条词条`);
}

main();
