#!/usr/bin/env node
/**
 * Vendor Pokémon Showdown trainer + itemicon sprites into `public/sprites`,
 * and pack each catalog into a WebP atlas + JSON frame map.
 *
 * Why: same-origin `/api/sprites` was the Vercel egress / invoke hot path for
 * trainers and item icons. Static files + atlases cut serverless fan-out.
 *
 * Licensing: sprites are from Pokémon Showdown (play.pokemonshowdown.com).
 * Same attribution posture as the existing Showdown proxy — fan art / game
 * assets redistributed for this app's UI, not for resale.
 *
 * Re-run when Showdown adds trainers or item icons:
 *   npm run data:sprites
 *
 * Artifacts are committed so Vercel Hobby builds do not depend on upstream.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOWDOWN = "https://play.pokemonshowdown.com";
const CONCURRENCY = 12;
const UA = "nuzlocke-manager-sprite-vendor/1.0";

/** @typedef {{ x: number; y: number; w: number; h: number }} Frame */
/** @typedef {{
 *   catalog: string;
 *   cell: number;
 *   image: string;
 *   width: number;
 *   height: number;
 *   count: number;
 *   frames: Record<string, Frame>;
 * }} AtlasJson */

/**
 * @param {string} folder
 * @returns {Promise<string[]>}
 */
async function listPngStems(folder) {
  const url = `${SHOWDOWN}/sprites/${folder}/?sort=name&view=dir`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`Failed to list ${folder}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const stems = new Set();
  for (const match of html.matchAll(/href="\.\/([^"]+\.png)"/gi)) {
    const file = match[1];
    const stem = file.replace(/\.png$/i, "").toLowerCase();
    if (/^[a-z0-9][a-z0-9._-]*$/.test(stem)) stems.add(stem);
  }
  if (stems.size === 0) {
    throw new Error(`No PNG stems found in ${folder} directory listing`);
  }
  return [...stems].sort();
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<void>} worker
 */
async function mapPool(items, limit, worker) {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
}

/**
 * @param {string} folder
 * @param {string} stem
 * @returns {Promise<Buffer>}
 */
async function downloadPng(folder, stem) {
  const url = `${SHOWDOWN}/sprites/${folder}/${stem}.png`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/png,image/*,*/*;q=0.8",
        Referer: `${SHOWDOWN}/`,
      },
    });
    lastStatus = res.status;
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) {
        throw new Error(`Download ${folder}/${stem}.png returned empty body`);
      }
      return buf;
    }
    if (res.status !== 403 && res.status !== 429) {
      throw new Error(`Download ${folder}/${stem}.png failed: HTTP ${res.status}`);
    }
  }
  throw new Error(`Download ${folder}/${stem}.png failed after retries: HTTP ${lastStatus}`);
}

/**
 * @param {string} catalog
 * @param {string[]} stems
 * @param {Map<string, Buffer>} buffers
 * @param {number} cell
 * @returns {Promise<{ atlasPath: string; jsonPath: string; dataJsonPath: string; meta: AtlasJson }>}
 */
async function buildAtlas(catalog, stems, buffers, cell) {
  /** @type {{ stem: string; buf: Buffer }[]} */
  const usable = [];
  for (const stem of stems) {
    const buf = buffers.get(stem);
    if (!buf || buf.length === 0) {
      console.warn(`  atlas skip ${stem}: empty buffer`);
      continue;
    }
    usable.push({ stem, buf });
  }
  if (usable.length === 0) {
    throw new Error(`No usable sprites for atlas ${catalog}`);
  }

  const cols = Math.ceil(Math.sqrt(usable.length));
  const rows = Math.ceil(usable.length / cols);
  const width = cols * cell;
  const height = rows * cell;

  /** @type {Record<string, Frame>} */
  const frames = {};
  /** @type {{ input: Buffer; left: number; top: number }[]} */
  const composites = [];

  for (let i = 0; i < usable.length; i++) {
    const { stem, buf } = usable[i];
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    try {
      const resized = await sharp(buf)
        .ensureAlpha()
        .resize(cell, cell, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      frames[stem] = { x, y, w: cell, h: cell };
      composites.push({ input: resized, left: x, top: y });
    } catch (err) {
      console.warn(
        `  atlas skip ${stem}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (composites.length === 0) {
    throw new Error(`Atlas composite empty for ${catalog}`);
  }

  const atlasDir = join(root, "public/sprites/atlases");
  mkdirSync(atlasDir, { recursive: true });
  const atlasPath = join(atlasDir, `${catalog}.webp`);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toFile(atlasPath);

  /** @type {AtlasJson} */
  const meta = {
    catalog,
    cell,
    image: `/sprites/atlases/${catalog}.webp`,
    width,
    height,
    count: Object.keys(frames).length,
    frames,
  };

  const publicJsonPath = join(atlasDir, `${catalog}.json`);
  writeFileSync(publicJsonPath, `${JSON.stringify(meta)}\n`);

  const dataDir = join(root, "src/data/sprite-atlases");
  mkdirSync(dataDir, { recursive: true });
  const dataJsonPath = join(dataDir, `${catalog}.json`);
  writeFileSync(dataJsonPath, `${JSON.stringify(meta)}\n`);

  return { atlasPath, jsonPath: publicJsonPath, dataJsonPath, meta };
}

/**
 * @param {string} catalog
 * @param {number} cell
 */
async function vendorCatalog(catalog, cell) {
  console.log(`\n=== ${catalog} (cell ${cell}px) ===`);
  const stems = await listPngStems(catalog);
  console.log(`Listed ${stems.length} stems`);

  const outDir = join(root, "public/sprites", catalog);
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  /** @type {Map<string, Buffer>} */
  const buffers = new Map();
  let done = 0;
  let failed = 0;

  await mapPool(stems, CONCURRENCY, async (stem) => {
    try {
      const buf = await downloadPng(catalog, stem);
      buffers.set(stem, buf);
      writeFileSync(join(outDir, `${stem}.png`), buf);
    } catch (err) {
      failed += 1;
      console.warn(`  skip ${stem}: ${err instanceof Error ? err.message : err}`);
    } finally {
      done += 1;
      if (done % 100 === 0 || done === stems.length) {
        console.log(`  downloaded ${done}/${stems.length} (${failed} failed)`);
      }
    }
  });

  const okStems = stems.filter((s) => buffers.has(s));
  if (okStems.length === 0) {
    throw new Error(`No sprites downloaded for ${catalog}`);
  }

  const { atlasPath, meta } = await buildAtlas(catalog, okStems, buffers, cell);
  console.log(
    `Atlas ${atlasPath} → ${meta.width}x${meta.height}, ${meta.count} frames`,
  );
  return { stems: okStems.length, failed };
}

async function main() {
  const started = Date.now();
  const trainers = await vendorCatalog("trainers", 80);
  const items = await vendorCatalog("itemicons", 24);

  const readme = join(root, "public/sprites/README.md");
  writeFileSync(
    readme,
    `# Vendored Showdown sprites

Static copies of Pokémon Showdown \`trainers\` and \`itemicons\` folders, plus
WebP atlases under \`atlases/\`.

Regenerate with:

\`\`\`bash
npm run data:sprites
\`\`\`

Source: https://play.pokemonshowdown.com/sprites/
`,
  );

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `trainers: ${trainers.stems} ok (${trainers.failed} failed), itemicons: ${items.stems} ok (${items.failed} failed)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
