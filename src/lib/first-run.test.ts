import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORCE_FIRST_RUN_CHROME,
  isFirstRunChrome,
  playerSeasonEntryPath,
} from "@/lib/first-run";

describe("isFirstRunChrome", () => {
  it("keeps FORCE_FIRST_RUN_CHROME off in committed code", () => {
    assert.equal(FORCE_FIRST_RUN_CHROME, false);
  });

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

describe("playerSeasonEntryPath", () => {
  const slug = "2026-trash-pack";

  it("sends spectators to the league board", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: false,
        introCompleted: false,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      `/challenges/${slug}`,
    );
  });

  it("sends unfinished intros to /new-trainer", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        introCompleted: false,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      `/challenges/${slug}/new-trainer`,
    );
  });

  it("sends players without a trainer row through /me to provision", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        introCompleted: null,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      `/challenges/${slug}/me`,
    );
  });

  it("sends post-create first-run players to /me (board + tour)", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        introCompleted: true,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      `/challenges/${slug}/me`,
    );
  });

  it("sends settled players to the league board", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        introCompleted: true,
        welcomeCompleted: true,
        hasProgress: false,
      }),
      `/challenges/${slug}`,
    );
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        introCompleted: true,
        welcomeCompleted: false,
        hasProgress: true,
      }),
      `/challenges/${slug}`,
    );
  });

  it("sends GMs to the league board even mid-funnel", () => {
    assert.equal(
      playerSeasonEntryPath(slug, {
        signedIn: true,
        isGm: true,
        introCompleted: false,
        welcomeCompleted: false,
        hasProgress: false,
      }),
      `/challenges/${slug}`,
    );
  });
});
