#!/usr/bin/env node
/**
 * Smoke-test Modern Emerald saves through the production parser.
 * Usage: node scripts/test-modern-save.mjs [path]
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path =
  process.argv[2] ?? `${process.env.HOME}/Downloads/revive_token_true.ss0`;

const result = spawnSync(
  "npx",
  ["tsx", join(root, "scripts/test-modern-save.ts"), path],
  { stdio: "inherit", cwd: root, shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
