import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lockBodyScroll } from "@/components/Modal";

const modalPath = new URL("./Modal.tsx", import.meta.url);
const stylesPath = new URL("../app/globals.css", import.meta.url);

test("freezes body scroll and restores the page position", () => {
  const environment = createScrollEnvironment();
  const unlock = lockBodyScroll(environment.document, environment.window);

  assert.deepEqual(environment.style, {
    left: "0",
    overflow: "hidden",
    paddingRight: "24px",
    position: "fixed",
    right: "0",
    top: "-640px",
    width: "100%",
  });

  unlock();

  assert.deepEqual(environment.style, environment.initialStyle);
  assert.deepEqual(environment.scrollCalls, [[0, 640]]);
});

test("keeps body scroll frozen until every nested modal closes", () => {
  const environment = createScrollEnvironment();
  const unlockParent = lockBodyScroll(environment.document, environment.window);
  const unlockChild = lockBodyScroll(environment.document, environment.window);

  unlockChild();
  assert.equal(environment.style.position, "fixed");
  assert.deepEqual(environment.scrollCalls, []);

  unlockParent();
  assert.deepEqual(environment.style, environment.initialStyle);
  assert.deepEqual(environment.scrollCalls, [[0, 640]]);
});

test("keeps mobile dismissal controls inside the dynamic safe viewport", async () => {
  const [source, styles] = await Promise.all([
    readFile(modalPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(source, /h-dvh/);
  assert.match(source, /max-h-\[92dvh\]/);
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /pb-\[env\(safe-area-inset-bottom,0px\)\]/);
  assert.match(source, /overscroll-none/);
  assert.match(
    styles,
    /body:has\(\[data-modal-open\]\)\s*\{[^}]*overscroll-behavior:\s*none;/,
  );
});

function createScrollEnvironment() {
  const initialStyle = {
    left: "1px",
    overflow: "visible",
    paddingRight: "8px",
    position: "relative",
    right: "2px",
    top: "3px",
    width: "auto",
  };
  const style = { ...initialStyle };
  const scrollCalls: Array<[number, number]> = [];
  const document = {
    body: { style },
    documentElement: { clientWidth: 1184 },
  } as unknown as Document;
  const window = {
    getComputedStyle: () => ({ paddingRight: "8px" }),
    innerWidth: 1200,
    scrollTo: (x: number, y: number) => scrollCalls.push([x, y]),
    scrollY: 640,
  } as unknown as Window;

  return {
    document,
    initialStyle,
    scrollCalls,
    style,
    window,
  };
}
