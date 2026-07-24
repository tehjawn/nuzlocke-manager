"use client";

import { useState, useTransition } from "react";
import {
  gmSetTrainerLockAction,
  gmUnclaimTrainerAction,
  gmUpdateChallengeMetaAction,
  gmUpdateFaqAction,
  gmUpdateRuleAction,
} from "@/app/actions/challenge";
import type { Challenge } from "@/lib/challenge-types";

export function GmConsole({ challenge }: { challenge: Challenge }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const challengeId = challenge.id;

  if (!challengeId) {
    return (
      <p className="text-sm text-danger">
        GM console requires a database-backed challenge. Seed the DB first.
      </p>
    );
  }

  function flash(result: { ok: true; message?: string } | { ok: false; error: string }) {
    if (result.ok) {
      setError(null);
      setMessage(result.message ?? "Saved");
    } else {
      setMessage(null);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">
          Season settings
        </header>
        <form
          className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              flash(
                await gmUpdateChallengeMetaAction({
                  challengeId,
                  visibility: String(fd.get("visibility")) as
                    | "INVITE"
                    | "UNLISTED"
                    | "PUBLIC",
                  playerInviteCode: String(fd.get("playerInviteCode") ?? ""),
                  gmInviteCode: String(fd.get("gmInviteCode") ?? ""),
                  description: String(fd.get("description") ?? ""),
                }),
              );
            });
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Visibility</span>
            <select
              name="visibility"
              defaultValue={challenge.visibility}
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
            >
              <option value="INVITE">Invite only</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">
              Player invite code
            </span>
            <input
              name="playerInviteCode"
              defaultValue={challenge.playerInviteCode ?? ""}
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">GM invite code</span>
            <input
              name="gmInviteCode"
              defaultValue={challenge.gmInviteCode ?? ""}
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold text-muted">Description</span>
            <textarea
              name="description"
              defaultValue={challenge.description}
              className="min-h-20 w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60 sm:col-span-2"
          >
            Save settings
          </button>
        </form>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">Roster</header>
        <ul className="divide-y-2 divide-frame/20 p-2">
          {challenge.trainers.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 text-sm"
            >
              <div>
                <p className="font-bold">{t.handle}</p>
                <p className="text-xs text-muted">
                  {t.userId ? `Claimed (${t.userId.slice(0, 8)}…)` : "Unclaimed"}
                  {t.mainSquadLocked ? " · Main locked" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="pressable rounded-sm bg-surface px-3 py-1 text-xs font-bold uppercase"
                  onClick={() => {
                    startTransition(async () => {
                      flash(
                        await gmSetTrainerLockAction({
                          trainerId: t.id,
                          locked: !t.mainSquadLocked,
                        }),
                      );
                    });
                  }}
                >
                  {t.mainSquadLocked ? "Unlock main" : "Lock main"}
                </button>
                {t.userId ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="pressable rounded-sm bg-danger px-3 py-1 text-xs font-bold text-white uppercase"
                    onClick={() => {
                      startTransition(async () => {
                        flash(
                          await gmUnclaimTrainerAction({ trainerId: t.id }),
                        );
                      });
                    }}
                  >
                    Unclaim
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">Rules</header>
        <div className="space-y-4 p-3 sm:p-4">
          {challenge.rules.map((rule) => (
            <form
              key={rule.id}
              className="grid gap-2 rounded-sm border-2 border-frame/30 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  flash(
                    await gmUpdateRuleAction({
                      challengeId,
                      ruleId: rule.id,
                      sortOrder: Number(fd.get("sortOrder") || rule.sortOrder),
                      title: String(fd.get("title") ?? ""),
                      body: String(fd.get("body") ?? ""),
                      isCore: fd.get("isCore") === "on",
                    }),
                  );
                });
              }}
            >
              <div className="flex gap-2">
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={rule.sortOrder}
                  className="w-20 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
                />
                <input
                  name="title"
                  defaultValue={rule.title ?? ""}
                  className="flex-1 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
                />
              </div>
              <textarea
                name="body"
                defaultValue={rule.body}
                className="min-h-16 w-full rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-2 text-xs">
                <input name="isCore" type="checkbox" defaultChecked={rule.isCore} />
                Core rule
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="pressable rounded-sm bg-accent px-3 py-1 text-xs font-bold text-white uppercase"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="pressable rounded-sm bg-danger px-3 py-1 text-xs font-bold text-white uppercase"
                  onClick={() => {
                    startTransition(async () => {
                      flash(
                        await gmUpdateRuleAction({
                          challengeId,
                          ruleId: rule.id,
                          sortOrder: rule.sortOrder,
                          title: rule.title ?? "",
                          body: rule.body,
                          isCore: rule.isCore,
                          delete: true,
                        }),
                      );
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </form>
          ))}
          <form
            className="grid gap-2 rounded-sm border-2 border-dashed border-frame/40 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                flash(
                  await gmUpdateRuleAction({
                    challengeId,
                    sortOrder: Number(fd.get("sortOrder") || challenge.rules.length + 1),
                    title: String(fd.get("title") ?? ""),
                    body: String(fd.get("body") ?? ""),
                    isCore: fd.get("isCore") === "on",
                  }),
                );
                e.currentTarget.reset();
              });
            }}
          >
            <p className="font-display text-xs font-bold uppercase">Add rule</p>
            <input
              name="sortOrder"
              type="number"
              placeholder="Order"
              className="rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
            />
            <input
              name="title"
              placeholder="Title"
              required
              className="rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
            />
            <textarea
              name="body"
              placeholder="Body"
              required
              className="min-h-16 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-xs">
              <input name="isCore" type="checkbox" /> Core rule
            </label>
            <button
              type="submit"
              disabled={pending}
              className="pressable w-fit rounded-sm bg-accent px-3 py-1 text-xs font-bold text-white uppercase"
            >
              Add
            </button>
          </form>
        </div>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">FAQ</header>
        <div className="space-y-4 p-3 sm:p-4">
          {challenge.faqs.map((faq) => (
            <form
              key={faq.id}
              className="grid gap-2 rounded-sm border-2 border-frame/30 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  flash(
                    await gmUpdateFaqAction({
                      challengeId,
                      faqId: faq.id,
                      sortOrder: Number(fd.get("sortOrder") || faq.sortOrder),
                      question: String(fd.get("question") ?? ""),
                      answer: String(fd.get("answer") ?? ""),
                    }),
                  );
                });
              }}
            >
              <input
                name="sortOrder"
                type="number"
                defaultValue={faq.sortOrder}
                className="w-20 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
              />
              <input
                name="question"
                defaultValue={faq.question}
                className="rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
              />
              <textarea
                name="answer"
                defaultValue={faq.answer}
                className="min-h-16 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="pressable rounded-sm bg-accent px-3 py-1 text-xs font-bold text-white uppercase"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="pressable rounded-sm bg-danger px-3 py-1 text-xs font-bold text-white uppercase"
                  onClick={() => {
                    startTransition(async () => {
                      flash(
                        await gmUpdateFaqAction({
                          challengeId,
                          faqId: faq.id,
                          sortOrder: faq.sortOrder,
                          question: faq.question,
                          answer: faq.answer,
                          delete: true,
                        }),
                      );
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </form>
          ))}
          <form
            className="grid gap-2 rounded-sm border-2 border-dashed border-frame/40 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                flash(
                  await gmUpdateFaqAction({
                    challengeId,
                    sortOrder: Number(
                      fd.get("sortOrder") || challenge.faqs.length + 1,
                    ),
                    question: String(fd.get("question") ?? ""),
                    answer: String(fd.get("answer") ?? ""),
                  }),
                );
                e.currentTarget.reset();
              });
            }}
          >
            <p className="font-display text-xs font-bold uppercase">Add FAQ</p>
            <input
              name="question"
              placeholder="Question"
              required
              className="rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
            />
            <textarea
              name="answer"
              placeholder="Answer"
              required
              className="min-h-16 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="pressable w-fit rounded-sm bg-accent px-3 py-1 text-xs font-bold text-white uppercase"
            >
              Add
            </button>
          </form>
        </div>
      </section>

      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
