import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_ACTIVE_KEY,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_TRANSITION_KEY,
  shouldOpenOnboardingTour,
  writeOnboardingActive,
  writeOnboardingStep,
  writeOnboardingTransition,
} from "@/lib/onboarding";

function withSessionStorage(run: () => void) {
  const memory = new Map<string, string>();
  const g = globalThis as typeof globalThis & {
    window?: unknown;
    sessionStorage?: Storage;
  };
  const prev = { window: g.window, sessionStorage: g.sessionStorage };
  const store = {
    getItem(key: string) {
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
    key() {
      return null;
    },
    get length() {
      return memory.size;
    },
  } as Storage;
  g.window = { sessionStorage: store };
  g.sessionStorage = store;
  try {
    run();
  } finally {
    g.window = prev.window;
    g.sessionStorage = prev.sessionStorage;
    memory.clear();
    // Avoid leaking keys if tests share a real sessionStorage.
    store.removeItem(ONBOARDING_ACTIVE_KEY);
    store.removeItem(ONBOARDING_STORAGE_KEY);
    store.removeItem(ONBOARDING_TRANSITION_KEY);
  }
}

test("shouldOpenOnboardingTour stays closed when inactive", () => {
  withSessionStorage(() => {
    assert.equal(
      shouldOpenOnboardingTour("/challenges/2026-trash-pack/trainers/t1"),
      false,
    );
  });
});

test("shouldOpenOnboardingTour opens only on a matching step route", () => {
  withSessionStorage(() => {
    writeOnboardingActive(true);
    writeOnboardingStep(3); // season-trainers
    assert.equal(
      shouldOpenOnboardingTour("/challenges/2026-trash-pack"),
      true,
    );
    assert.equal(
      shouldOpenOnboardingTour("/challenges/2026-trash-pack/trainers/t1"),
      false,
    );
  });
});

test("shouldOpenOnboardingTour opens during a bridge even off-route", () => {
  withSessionStorage(() => {
    writeOnboardingActive(true);
    writeOnboardingStep(3);
    writeOnboardingTransition(true);
    assert.equal(
      shouldOpenOnboardingTour("/challenges/2026-trash-pack/trainers/t1"),
      true,
    );
  });
});
