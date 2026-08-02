import assert from "node:assert/strict";
import test from "node:test";
import { prependPersistedWelcome } from "@/lib/notifications";

type Row = {
  id: string;
  type: string;
  actionKey: string | null;
};

const welcome: Row = {
  id: "welcome-row",
  type: "WELCOME",
  actionKey: "welcome",
};

const recent: Row = {
  id: "recent-row",
  type: "UPDATE",
  actionKey: null,
};

test("uses an older persisted welcome without running the backfill write", async () => {
  let ensureCalls = 0;
  const rows = await prependPersistedWelcome(
    [recent],
    async () => welcome,
    async () => {
      ensureCalls += 1;
      return welcome;
    },
  );

  assert.deepEqual(rows, [welcome, recent]);
  assert.equal(ensureCalls, 0);
});

test("backfills only when no persisted welcome exists", async () => {
  let ensureCalls = 0;
  const rows = await prependPersistedWelcome(
    [recent],
    async () => null,
    async () => {
      ensureCalls += 1;
      return welcome;
    },
  );

  assert.deepEqual(rows, [welcome, recent]);
  assert.equal(ensureCalls, 1);
});

test("skips both lookups when the recent page contains the welcome", async () => {
  let findCalls = 0;
  let ensureCalls = 0;
  const rows = await prependPersistedWelcome(
    [welcome, recent],
    async () => {
      findCalls += 1;
      return welcome;
    },
    async () => {
      ensureCalls += 1;
      return welcome;
    },
  );

  assert.deepEqual(rows, [welcome, recent]);
  assert.equal(findCalls, 0);
  assert.equal(ensureCalls, 0);
});
