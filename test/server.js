"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const routes = new Map([
  ["/", path.join(__dirname, "fixture.html")],
  ["/models", path.join(__dirname, "fixture.html")],
  ["/benchmarks", path.join(__dirname, "fixture.html")],
  ["/example/text-model", path.join(__dirname, "fixture.html")],
  [
    "/compare/openai/gpt-5.6-luna/deepseek/deepseek-v4-flash-0731",
    path.join(__dirname, "fixture.html"),
  ],
  ["/openrouter-zh-cny.user.js", path.join(root, "openrouter-zh-cny.user.js")],
]);
const port = Number(process.env.PORT || 4173);

http
  .createServer((request, response) => {
    const file = routes.get(new URL(request.url, `http://${request.headers.host}`).pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const type = file.endsWith(".js") ? "text/javascript" : "text/html";
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": `${type}; charset=utf-8`,
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Fixture: http://127.0.0.1:${port}/models`);
  });
