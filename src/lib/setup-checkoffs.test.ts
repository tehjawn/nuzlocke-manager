import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_SETUP_CHECKOFFS,
  isSetupSectionChecked,
  nextSetupSection,
  setSetupSectionChecked,
  setupCheckoffsStorageKey,
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
