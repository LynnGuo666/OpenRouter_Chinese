"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const routes = new Map([
  ["/models", path.join(__dirname, "fixture.html")],
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
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Fixture: http://127.0.0.1:${port}/models`);
  });
