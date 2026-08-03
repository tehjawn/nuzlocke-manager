import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPlannerDraft,
  PLANNER_DRAFT_MAX,
  readPlannerDraftState,
  setPlannerDraftIds,
  writePlannerDraft,
} from "@/features/planner/planner-drafts";

class MemoryStorage {
  #map = new Map<string, string>();
  getItem(key: string) {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.#map.set(key, String(value));
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
}

const memory = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: memory,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: memory,
    dispatchEvent() {
      return true;
    },
  },
  configurable: true,
});
Object.defineProperty(globalThis, "CustomEvent", {
  value: class CustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  configurable: true,
});

const KEY = "nuzlocke-planner-draft:test:trainer";

test("missing key is not found and yields empty draft", () => {
  const fresh = `${KEY}:missing-${Date.now()}`;
  const state = readPlannerDraftState(fresh);
  assert.equal(state.found, false);
  assert.deepEqual(state.draft.entryIds, []);
});

test("clear persists an empty draft that stays found", () => {
  const key = `${KEY}:clear-${Date.now()}`;
  setPlannerDraftIds(key, ["a", "b"]);
  clearPlannerDraft(key);
  const state = readPlannerDraftState(key);
  assert.equal(state.found, true);
  assert.deepEqual(state.draft.entryIds, []);
  assert.equal(localStorage.getItem(key), JSON.stringify({ entryIds: [] }));
});

test("write caps entry ids to PLANNER_DRAFT_MAX", () => {
  const key = `${KEY}:cap-${Date.now()}`;
  const ids = Array.from({ length: PLANNER_DRAFT_MAX + 3 }, (_, i) => `id-${i}`);
  writePlannerDraft(key, { entryIds: ids });
  const state = readPlannerDraftState(key);
  assert.equal(state.draft.entryIds.length, PLANNER_DRAFT_MAX);
});
