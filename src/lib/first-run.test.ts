import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFirstRunChrome } from "@/lib/first-run";

describe("isFirstRunChrome", () => {
  it("is true for signed-in players with unread welcome and no progress", () => {
    assert.equal(
      isFirstRunChrome({
        signedIn: true,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      true,
    );
  });

  it("is false once welcome is completed", () => {
    assert.equal(
      isFirstRunChrome({
        signedIn: true,
        welcomeCompleted: true,
        hasProgress: false,
      }),
      false,
    );
  });

  it("is false once the player has party progress", () => {
    assert.equal(
      isFirstRunChrome({
        signedIn: true,
        welcomeCompleted: false,
        hasProgress: true,
      }),
      false,
    );
  });

  it("is false for spectators (signed out)", () => {
    assert.equal(
      isFirstRunChrome({
        signedIn: false,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      false,
    );
  });

  it("is false for GMs even with unread welcome", () => {
    assert.equal(
      isFirstRunChrome({
        signedIn: true,
        welcomeCompleted: false,
        hasProgress: false,
        isGm: true,
      }),
      false,
    );
  });
});
