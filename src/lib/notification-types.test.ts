import assert from "node:assert/strict";
import test from "node:test";
import {
  withPinnedWelcome,
  type NotificationItem,
} from "@/lib/notification-types";

function item(
  partial: Partial<NotificationItem> & Pick<NotificationItem, "id" | "type">,
): NotificationItem {
  return {
    actionKey: null,
    body: null,
    createdAt: new Date(0).toISOString(),
    readAt: null,
    title: "Title",
    ...partial,
  };
}

test("pins an existing welcome row first without inventing one", () => {
  const welcome = item({
    id: "w1",
    type: "WELCOME",
    actionKey: "welcome",
    title: "stale",
  });
  const other = item({ id: "n1", type: "FEEDBACK", title: "New bug" });
  const pinned = withPinnedWelcome([other, welcome]);
  assert.equal(pinned[0]?.id, "w1");
  assert.equal(pinned[0]?.title, "Welcome to Trash Pack 2026!");
  assert.equal(pinned[1]?.id, "n1");
});

test("leaves the list alone when welcome is absent (archived / dismissed)", () => {
  const other = item({ id: "n1", type: "FEEDBACK", title: "New bug" });
  assert.deepEqual(withPinnedWelcome([other]), [other]);
  assert.deepEqual(withPinnedWelcome([]), []);
});
