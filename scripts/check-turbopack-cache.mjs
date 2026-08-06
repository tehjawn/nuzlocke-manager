// Warns when Turbopack's dev filesystem cache has grown large enough to bloat
// the dev server's memory footprint. The cache is an mmap'd LSM store, so its
// resident pages count toward `next-server`'s RSS -- a 54 GB cache showed up as
// ~19 GB of "memory used" before it was cleared.
//
// Turbopack appends SST segments each session and never prunes them, so this
// only ever grows. Advisory only: never fails, never blocks `next dev`.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = ".next/dev/cache/turbopack";
const GIB = 1024 ** 3;
const threshold = Number(process.env.TURBOPACK_CACHE_WARN_GB || 6) * GIB;

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    try {
      total += entry.isDirectory() ? dirSize(path) : statSync(path).size;
    } catch {
      // Files churn while the dev server runs; a vanished entry is not an error.
    }
  }
  return total;
}

let size;
try {
  size = dirSize(CACHE_DIR);
} catch {
  process.exit(0); // No cache yet -- nothing to warn about.
}

if (size >= threshold) {
  const gb = (size / GIB).toFixed(1);
  process.stderr.write(
    `\n\x1b[33m⚠  Turbopack dev cache is ${gb} GB.\x1b[0m\n` +
      `   It inflates dev-server memory and never prunes itself.\n` +
      `   Clear it with: \x1b[1mnpm run dev:fresh\x1b[0m\n\n`,
  );
}
