import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_SETUP_CHECKOFFS,
  isSetupSectionChecked,
  nextSetupSection,
  readSetupCheckoffs,
  setSetupSectionChecked,
  setupCheckoffsStorageKey,
  subscribeSetupCheckoffs,
  writeSetupCheckoffs,
} from "@/lib/setup-checkoffs";

test("setupCheckoffsStorageKey scopes by season + trainer", () => {
  assert.equal(
    setupCheckoffsStorageKey("2026-trash-pack", "t1"),
    "nuzlocke-setup-checkoffs:2026-trash-pack:t1",
  );
  assert.equal(
    setupCheckoffsStorageKey("2026-trash-pack", null),
    "nuzlocke-setup-checkoffs:2026-trash-pack:anon",
  );
});

test("nextSetupSection walks the checklist in order", () => {
  assert.equal(nextSetupSection(EMPTY_SETUP_CHECKOFFS), "welcome");
  const afterWelcome = {
    checkedSectionIds: ["welcome" as const],
  };
  assert.equal(nextSetupSection(afterWelcome), "rom");
  const all = {
    checkedSectionIds: [
      "welcome" as const,
      "rom" as const,
      "afterplay" as const,
      "gamemode" as const,
      "import" as const,
    ],
  };
  assert.equal(nextSetupSection(all), null);
});

test("setSetupSectionChecked toggles membership", () => {
  const key = setupCheckoffsStorageKey("test-season", "trainer-a");
  writeSetupCheckoffs(key, EMPTY_SETUP_CHECKOFFS);
  const checked = setSetupSectionChecked(key, "rom", true);
  assert.equal(isSetupSectionChecked(checked, "rom"), true);
  const unchecked = setSetupSectionChecked(key, "rom", false);
  assert.equal(isSetupSectionChecked(unchecked, "rom"), false);
});

test("cross-tab storage events invalidate the in-memory cache", () => {
  const memory = new Map<string, string>();
  const target = new EventTarget();
  class MockStorageEvent extends Event {
    key: string | null;
    newValue: string | null;
    constructor(
      type: string,
      init?: { key?: string | null; newValue?: string | null },
    ) {
      super(type);
      this.key = init?.key ?? null;
      this.newValue = init?.newValue ?? null;
    }
  }
  const localStorageMock = {
    getItem(k: string) {
      return memory.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      memory.set(k, v);
    },
    removeItem(k: string) {
      memory.delete(k);
    },
  };
  const g = globalThis as typeof globalThis & {
    window?: EventTarget & {
      localStorage: typeof localStorageMock;
      dispatchEvent: (event: Event) => boolean;
    };
    localStorage?: typeof localStorageMock;
    StorageEvent?: typeof MockStorageEvent;
  };
  const prev = {
    window: g.window,
    localStorage: g.localStorage,
    StorageEvent: g.StorageEvent,
  };
  g.window = Object.assign(target, { localStorage: localStorageMock });
  g.localStorage = localStorageMock;
  g.StorageEvent = MockStorageEvent;

  try {
    const key = setupCheckoffsStorageKey("test-season", "cross-tab");
    writeSetupCheckoffs(key, { checkedSectionIds: ["welcome"] });
    assert.deepEqual(
      readSetupCheckoffs(key).checkedSectionIds,
      ["welcome"],
    );

    let notified = 0;
    const unsubscribe = subscribeSetupCheckoffs(key, () => {
      notified += 1;
    });

    // Other tab wrote localStorage without going through our write helper.
    memory.set(
      key,
      JSON.stringify({ checkedSectionIds: ["welcome", "rom"] }),
    );
    g.window!.dispatchEvent(
      new MockStorageEvent("storage", {
        key,
        newValue: JSON.stringify({ checkedSectionIds: ["welcome", "rom"] }),
      }),
    );

    assert.equal(notified, 1);
    assert.deepEqual(readSetupCheckoffs(key).checkedSectionIds, [
      "welcome",
      "rom",
    ]);
    unsubscribe();
  } finally {
    g.window = prev.window;
    g.localStorage = prev.localStorage;
    g.StorageEvent = prev.StorageEvent;
  }
});
