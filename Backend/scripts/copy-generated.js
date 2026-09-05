/**
 * Copies the generated Prisma client into the build output.
 *
 * The generator writes a JavaScript package to `src/generated/prisma`, and
 * `tsc` only emits files it compiles — it does not copy .js assets. So
 * `dist/core/prisma/client.js` resolved `../../generated/prisma` to a
 * directory that was never created, and `node dist/app.js` died at startup
 * with MODULE_NOT_FOUND. Development never noticed because it runs from
 * `src` through tsx.
 */
const fs = require("node:fs");
const path = require("node:path");

const from = path.join(__dirname, "..", "src", "generated");
const to = path.join(__dirname, "..", "dist", "generated");

if (!fs.existsSync(from)) {
  console.error(
    "Prisma client not found at src/generated — run `npm run prisma:generate` first.",
  );
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log("Copied generated Prisma client into dist/.");
