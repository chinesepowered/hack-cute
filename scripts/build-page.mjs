// Convex functions can't read the filesystem, so the page is compiled into a
// TS module that the HTTP action serves. Run after editing public/index.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");

// Escape for a TS template literal: backslashes, backticks, and ${ interpolation.
const safe = html
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

fs.writeFileSync(
  path.join(ROOT, "convex/page.ts"),
  `// GENERATED from public/index.html — run: node scripts/build-page.mjs\n` +
  `/* eslint-disable */\nexport const PAGE = \`${safe}\`;\n`,
);

console.log(`convex/page.ts written (${(safe.length / 1024).toFixed(1)} KB)`);
