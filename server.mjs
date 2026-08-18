// Convex owns all state, files and realtime updates. This just serves the page
// and tells the browser which deployment to talk to.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);

function convexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  for (const f of [".env.local", ".env"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^CONVEX_URL=(.+)$/m);
    if (m) return m[1].trim();
  }
  return "";
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ convexUrl: convexUrl() }));
  }

  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
}).listen(PORT, () => {
  const u = convexUrl();
  console.log(`\n  Wish You Were Here → http://localhost:${PORT}`);
  console.log(`  convex: ${u || "NOT CONFIGURED — run: npx convex dev"}\n`);
});
