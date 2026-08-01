import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const stylesPath = new URL("./globals.css", import.meta.url);
const launcherPath = new URL("../components/GmToolsLauncher.tsx", import.meta.url);

test("keeps the GM tools launcher above console content", async () => {
  const [styles, launcher] = await Promise.all([
    readFile(stylesPath, "utf8"),
    readFile(launcherPath, "utf8"),
  ]);
  const pageRule = getRuleBody(styles, ".gm-console-page");
  const gridRule = getRuleBody(styles, ".gm-console-page::before");
  const contentRule = getRuleBody(styles, ".gm-console-page > main");
  const broadChildRule = findRuleBody(styles, ".gm-console-page > *");
  const launcherWrapper = launcher.match(
    /<div\s+className="([^"]*\bpointer-events-none\b[^"]*)"/,
  );

  assert.doesNotMatch(pageRule, /isolation:\s*isolate/);
  assert.match(gridRule, /z-index:\s*0;/);
  assert.match(contentRule, /z-index:\s*1;/);
  assert.doesNotMatch(broadChildRule ?? "", /z-index:/);
  assert.ok(launcherWrapper);
  assert.match(launcherWrapper[1], /(?:^|\s)fixed(?:\s|$)/);
  assert.match(launcherWrapper[1], /(?:^|\s)z-40(?:\s|$)/);
});

function findRuleBody(styles: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? null;
}

function getRuleBody(styles: string, selector: string): string {
  const rule = findRuleBody(styles, selector);
  assert.ok(rule, `Expected a ${selector} rule`);
  return rule;
}
