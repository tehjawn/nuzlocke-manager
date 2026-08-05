"use client";

import Link from "next/link";
import { useId, useState, useTransition, type ReactNode } from "react";
import {
  gmExportChallengeAction,
  gmReconstructMemorialHistoryAction,
  gmResetAllTrainerBoardsAction,
  gmSetTrainerLockAction,
  gmUnclaimTrainerAction,
  gmUpdateChallengeMetaAction,
  gmUpdateFaqAction,
  gmUpdateRuleAction,
  previewSeasonMemorialBackfillAction,
} from "@/app/actions/challenge";
import { updateFeedbackStatusAction } from "@/app/actions/feedback";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { displayActionError } from "@/lib/action-error-display";
import type { Challenge } from "@/lib/challenge-types";
import {
  FEEDBACK_STATUSES,
  feedbackCategoryLabel,
  feedbackStatusClass,
  feedbackStatusLabel,
  formatFeedbackDate,
  type FeedbackSubmissionItem,
} from "@/lib/feedback-types";
import {
  DEFAULT_ROM_DOWNLOAD_URL,
  fromEasternDatetimeLocalInput,
  getWelcomeVideoUrl,
  toEasternDatetimeLocalInput,
} from "@/lib/welcome-video";

const hintLinkClass =
  "font-medium text-ink underline-offset-2 hover:text-accent-deep hover:underline";

const FALLBACK_WELCOME_VIDEO_URL = getWelcomeVideoUrl();

type ConsoleTab =
  | "season"
  | "roster"
  | "rules"
  | "faq"
  | "feedback"
  | "ops";

const TABS: Array<{ id: ConsoleTab; label: string; index: string }> = [
  { id: "season", label: "Season", index: "01" },
  { id: "roster", label: "Roster", index: "02" },
  { id: "rules", label: "Rules", index: "03" },
  { id: "faq", label: "FAQ", index: "04" },
  { id: "feedback", label: "Feedback", index: "05" },
  { id: "ops", label: "Ops", index: "06" },
];

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: Challenge["status"]): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "TOURNAMENT":
      return "Tournament";
    case "ARCHIVED":
      return "Archived";
  }
}

function visibilityLabel(visibility: Challenge["visibility"]): string {
  switch (visibility) {
    case "INVITE":
      return "Invite only";
    case "UNLISTED":
      return "Unlisted";
    case "PUBLIC":
      return "Public";
  }
}

function Panel({
  kicker,
  title,
  description,
  danger = false,
  children,
  trailing,
}: {
  kicker: string;
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <section
      className={`gm-console__panel${danger ? " gm-console__panel--danger" : ""}`}
    >
      <div className="gm-console__panel-chrome">
        <header className="gm-console__panel-head">
          <div className="min-w-0">
            <p className="gm-console__panel-kicker">{kicker}</p>
            <h2 className="gm-console__panel-title">{title}</h2>
            {description ? (
              <p className="gm-console__panel-desc">{description}</p>
            ) : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </header>
        <div className="gm-console__panel-body">{children}</div>
      </div>
    </section>
  );
}

export function GmConsole({
  challenge,
  feedbackSubmissions,
  initialTab,
}: {
  challenge: Challenge;
  feedbackSubmissions: FeedbackSubmissionItem[];
  initialTab: ConsoleTab;
}) {
  const [pending, startTransition] = useTransition();
  const [, startTabTransition] = useTransition();
  const [tab, setTab] = useState<ConsoleTab>(initialTab);
  const [flashState, setFlashState] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const navLabelId = useId();
  const challengeId = challenge.id;

  if (!challengeId) {
    return (
      <p className="text-sm text-danger">
        GM console requires a database-backed challenge. Seed the DB first.
      </p>
    );
  }

  const rosterStats = challenge.trainers.reduce(
    (acc, t) => {
      if (t.userId) acc.claimed += 1;
      if (t.mainSquadLocked) acc.locked += 1;
      acc.wipeTotal += t.wipeCount;
      acc.completionTotal += t.completionCount ?? 0;
      return acc;
    },
    { claimed: 0, locked: 0, wipeTotal: 0, completionTotal: 0 },
  );
  const boardHref = `/challenges/${challenge.slug}`;
  const openFeedbackCount = feedbackSubmissions.filter(
    (submission) => submission.status !== "RESOLVED",
  ).length;

  function flash(
    result: { ok: true; message?: string } | { ok: false; error: string },
  ) {
    if (result.ok) {
      setFlashState({ tone: "ok", text: result.message ?? "Saved" });
    } else {
      setFlashState({ tone: "err", text: result.error });
    }
  }

  return (
    <div className="gm-console">
      <div className="gm-console__hero">
        <div className="gm-console__hero-chrome">
          <div className="gm-console__hero-inner">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="gm-console__eyebrow">
                  <span className="gm-console__badge" aria-hidden>
                    GM
                  </span>
                  Command center
                </p>
                <h1 className="gm-console__title">{challenge.name}</h1>
                <p className="gm-console__lede">
                  Season operations for {challenge.year}
                  {challenge.game ? ` · ${challenge.game}` : ""}. Configure
                  access, roster, content, and backups from one glass desk.
                </p>
              </div>
              <Link href={boardHref} className="gm-console__btn gm-console__btn--ghost">
                ← League board
              </Link>
            </div>

            <div className="gm-console__meta" aria-label="Season status">
              <span
                className={`gm-console__chip${
                  challenge.status === "ACTIVE" ||
                  challenge.status === "TOURNAMENT"
                    ? " gm-console__chip--live"
                    : challenge.status === "ARCHIVED"
                      ? " gm-console__chip--danger"
                      : " gm-console__chip--warn"
                }`}
              >
                <span className="gm-console__chip-dot" aria-hidden />
                {statusLabel(challenge.status)}
              </span>
              <span className="gm-console__chip">
                {visibilityLabel(challenge.visibility)}
              </span>
              <span className="gm-console__chip">
                {rosterStats.claimed}/{challenge.trainers.length} claimed
              </span>
            </div>

            <div className="gm-console__stats" aria-label="Season metrics">
              <div className="gm-console__stat">
                <span className="gm-console__stat-label">Trainers</span>
                <span className="gm-console__stat-value">
                  {challenge.trainers.length}
                </span>
              </div>
              <div className="gm-console__stat">
                <span className="gm-console__stat-label">Claimed</span>
                <span className="gm-console__stat-value">
                  {rosterStats.claimed}
                </span>
              </div>
              <div className="gm-console__stat">
                <span className="gm-console__stat-label">Main locked</span>
                <span className="gm-console__stat-value">
                  {rosterStats.locked}
                </span>
              </div>
              <div className="gm-console__stat">
                <span className="gm-console__stat-label">Total wipes</span>
                <span className="gm-console__stat-value">
                  {rosterStats.wipeTotal}
                </span>
              </div>
              <div className="gm-console__stat">
                <span className="gm-console__stat-label">Completions</span>
                <span className="gm-console__stat-value">
                  {rosterStats.completionTotal}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {flashState ? (
        <div
          className={`gm-console__flash ${
            flashState.tone === "err"
              ? "gm-console__flash--err"
              : "gm-console__flash--ok"
          }`}
          role="status"
          aria-live="polite"
        >
          {flashState.text}
        </div>
      ) : null}

      <div className="gm-console__layout">
        <nav
          className="gm-console__nav"
          aria-labelledby={navLabelId}
        >
          <p id={navLabelId} className="sr-only">
            Console sections
          </p>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`gm-console__nav-btn${
                tab === item.id ? " gm-console__nav-btn--active" : ""
              }`}
              aria-current={tab === item.id ? "page" : undefined}
              data-testid={
                item.id === "feedback" ? "gm-tab-feedback" : undefined
              }
              onClick={() => {
                startTabTransition(() => setTab(item.id));
              }}
            >
              <span className="gm-console__nav-index" aria-hidden>
                {item.index}
              </span>
              {item.label}
              {item.id === "feedback" && openFeedbackCount > 0 && (
                <span className="ml-auto rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--on-accent)]">
                  {openFeedbackCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="gm-console__panels" key={tab}>
          {tab === "season" ? (
            <Panel
              kicker="01 · Season"
              title="Season settings"
              description="Identity, access, Discord alerts, and Get Started links."
            >
              <form
                className="gm-console__grid gm-console__grid--2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  startTransition(async () => {
                    const rawPublishAt = String(
                      fd.get("welcomeVideoPublishAt") ?? "",
                    ).trim();
                    let welcomeVideoPublishAt: string | null = null;
                    if (rawPublishAt) {
                      const parsed =
                        fromEasternDatetimeLocalInput(rawPublishAt);
                      if (!parsed) {
                        flash({
                          ok: false,
                          error: "Invalid welcome video publish time",
                        });
                        return;
                      }
                      welcomeVideoPublishAt = parsed.toISOString();
                    }
                    flash(
                      await gmUpdateChallengeMetaAction({
                        challengeId,
                        name: String(fd.get("name") ?? ""),
                        game: String(fd.get("game") ?? ""),
                        status: String(fd.get("status")) as
                          | "DRAFT"
                          | "ACTIVE"
                          | "TOURNAMENT"
                          | "ARCHIVED",
                        visibility: String(fd.get("visibility")) as
                          | "INVITE"
                          | "UNLISTED"
                          | "PUBLIC",
                        playerInviteCode: String(
                          fd.get("playerInviteCode") ?? "",
                        ),
                        gmInviteCode: String(fd.get("gmInviteCode") ?? ""),
                        description: String(fd.get("description") ?? ""),
                        discordWebhookUrl: String(
                          fd.get("discordWebhookUrl") ?? "",
                        ),
                        welcomeVideoUrl: String(fd.get("welcomeVideoUrl") ?? ""),
                        welcomeVideoPublishAt,
                        romUrl: String(fd.get("romUrl") ?? ""),
                      }),
                    );
                  });
                }}
              >
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">Season name</span>
                  <input
                    name="name"
                    required
                    defaultValue={challenge.name}
                    className="gm-console__input"
                  />
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">Game</span>
                  <input
                    name="game"
                    defaultValue={challenge.game ?? ""}
                    placeholder="Pokémon Emerald Modern"
                    className="gm-console__input"
                  />
                  <span className="gm-console__hint">
                    Shown on General info. Example: Pokémon Emerald Modern.
                  </span>
                </label>
                <label className="gm-console__field">
                  <span className="gm-console__label">Status</span>
                  <select
                    name="status"
                    defaultValue={challenge.status}
                    className="gm-console__select"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TOURNAMENT">Tournament</option>
                    <option value="ARCHIVED">Archived (read-only)</option>
                  </select>
                </label>
                <label className="gm-console__field">
                  <span className="gm-console__label">Visibility</span>
                  <select
                    name="visibility"
                    defaultValue={challenge.visibility}
                    className="gm-console__select"
                  >
                    <option value="INVITE">Invite only</option>
                    <option value="UNLISTED">Unlisted</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>
                <label className="gm-console__field">
                  <span className="gm-console__label">Player invite code</span>
                  <input
                    name="playerInviteCode"
                    defaultValue={challenge.playerInviteCode ?? ""}
                    className="gm-console__input"
                  />
                </label>
                <label className="gm-console__field">
                  <span className="gm-console__label">GM invite code</span>
                  <input
                    name="gmInviteCode"
                    defaultValue={challenge.gmInviteCode ?? ""}
                    className="gm-console__input"
                  />
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">Description</span>
                  <textarea
                    name="description"
                    defaultValue={challenge.description}
                    className="gm-console__textarea"
                  />
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">Discord webhook URL</span>
                  <input
                    name="discordWebhookUrl"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/…"
                    defaultValue={challenge.discordWebhookUrl ?? ""}
                    className="gm-console__input"
                  />
                  <span className="gm-console__hint">
                    Posts deaths, badges earned, and revive uses. Leave blank to
                    disable.
                  </span>
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">
                    Embed welcome video URL
                  </span>
                  <input
                    name="welcomeVideoUrl"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=… or Drive link"
                    defaultValue={challenge.welcomeVideoUrl ?? ""}
                    className="gm-console__input"
                  />
                  <span className="gm-console__hint">
                    YouTube, Google Drive, or direct .mp4 shown on Get Started.
                    Leave blank to use the app env fallback
                    {FALLBACK_WELCOME_VIDEO_URL ? (
                      <>
                        {" "}
                        (
                        <a
                          href={FALLBACK_WELCOME_VIDEO_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={hintLinkClass}
                        >
                          open fallback
                        </a>
                        )
                      </>
                    ) : (
                      " (none set)"
                    )}
                    .
                  </span>
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">ROM download URL</span>
                  <input
                    name="romUrl"
                    type="url"
                    placeholder="https://drive.google.com/file/d/…"
                    defaultValue={challenge.romUrl ?? ""}
                    className="gm-console__input"
                  />
                  <span className="gm-console__hint">
                    Linked from Get Started step 1. Leave blank to use the
                    built-in Trash Pack Drive link (
                    <a
                      href={DEFAULT_ROM_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={hintLinkClass}
                    >
                      open fallback
                    </a>
                    ).
                  </span>
                </label>
                <label className="gm-console__field sm:col-span-2">
                  <span className="gm-console__label">
                    Welcome video publish time (Eastern)
                  </span>
                  <input
                    name="welcomeVideoPublishAt"
                    type="datetime-local"
                    defaultValue={toEasternDatetimeLocalInput(
                      challenge.welcomeVideoPublishAt,
                    )}
                    className="gm-console__input sm:max-w-xs"
                  />
                  <span className="gm-console__hint">
                    When the Get Started welcome video unlocks for everyone.
                    Defaults to 9:00 PM Eastern tonight. Turn on GM view to
                    preview it early.
                  </span>
                </label>
                <div className="gm-console__actions sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="gm-console__btn gm-console__btn--accent"
                  >
                    Save settings
                  </button>
                </div>
              </form>
            </Panel>
          ) : null}

          {tab === "roster" ? (
            <Panel
              kicker="02 · Roster"
              title="Trainer roster"
              description="Lock Championship mains, unclaim boards, and jump into any trainer."
              trailing={
                <span className="gm-console__chip">
                  {challenge.trainers.length} trainers
                </span>
              }
            >
              {challenge.trainers.length === 0 ? (
                <p className="gm-console__hint">No trainers in this season yet.</p>
              ) : (
                <ul className="gm-console__roster">
                  {challenge.trainers.map((t) => (
                    <li key={t.id} className="gm-console__trainer">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarPortrait
                          avatarSpriteKey={t.avatarSpriteKey}
                          backgroundKey={t.avatarBackgroundKey}
                          sizeClass="h-11 w-11"
                          width={44}
                          height={44}
                          className="shrink-0 overflow-hidden rounded-lg border border-frame/50"
                          alt=""
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="gm-console__trainer-name">{t.handle}</p>
                            {t.userId ? (
                              <span className="gm-console__pill gm-console__pill--ok">
                                Claimed
                              </span>
                            ) : (
                              <span className="gm-console__pill">Open</span>
                            )}
                            {t.mainSquadLocked ? (
                              <span className="gm-console__pill gm-console__pill--lock">
                                Main locked
                              </span>
                            ) : null}
                          </div>
                          <p className="gm-console__trainer-meta">
                            {t.realName ? `${t.realName} · ` : ""}
                            Run {t.activeRunNumber}
                            {(t.completionCount ?? 0) > 0
                              ? ` · ${t.completionCount} completion${t.completionCount === 1 ? "" : "s"}`
                              : ""}
                            {t.runEnded ? " · run finished" : ""}
                            {t.reviveUsed ? " · revive used" : ""}
                            {t.userId
                              ? ` · ${t.userId.slice(0, 8)}…`
                              : " · unclaimed"}
                          </p>
                        </div>
                      </div>
                      <div className="gm-console__actions">
                        <Link
                          href={`${boardHref}/trainers/${t.id}`}
                          className="gm-console__btn gm-console__btn--ghost"
                        >
                          Open board
                        </Link>
                        <button
                          type="button"
                          disabled={pending}
                          className="gm-console__btn"
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
                            className="gm-console__btn gm-console__btn--danger"
                            onClick={() => {
                              startTransition(async () => {
                                flash(
                                  await gmUnclaimTrainerAction({
                                    trainerId: t.id,
                                  }),
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
              )}
            </Panel>
          ) : null}

          {tab === "rules" ? (
            <Panel
              kicker="03 · Content"
              title="Rules"
              description="Core and house rules shown on the season Rules page."
            >
              <div className="space-y-3">
                {challenge.rules.map((rule) => (
                  <form
                    key={rule.id}
                    className="gm-console__editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        flash(
                          await gmUpdateRuleAction({
                            challengeId,
                            ruleId: rule.id,
                            sortOrder: Number(
                              fd.get("sortOrder") || rule.sortOrder,
                            ),
                            title: String(fd.get("title") ?? ""),
                            body: String(fd.get("body") ?? ""),
                            isCore: fd.get("isCore") === "on",
                          }),
                        );
                      });
                    }}
                  >
                    <div className="gm-console__grid gm-console__grid--2">
                      <label className="gm-console__field">
                        <span className="gm-console__label">Order</span>
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue={rule.sortOrder}
                          className="gm-console__input"
                        />
                      </label>
                      <label className="gm-console__field">
                        <span className="gm-console__label">Title</span>
                        <input
                          name="title"
                          defaultValue={rule.title ?? ""}
                          className="gm-console__input"
                        />
                      </label>
                    </div>
                    <label className="gm-console__field">
                      <span className="gm-console__label">Body</span>
                      <textarea
                        name="body"
                        defaultValue={rule.body}
                        className="gm-console__textarea"
                      />
                      <MarkdownHint />
                    </label>
                    <label className="gm-console__check">
                      <input
                        name="isCore"
                        type="checkbox"
                        defaultChecked={rule.isCore}
                      />
                      Core rule
                    </label>
                    <div className="gm-console__actions">
                      <button
                        type="submit"
                        disabled={pending}
                        className="gm-console__btn gm-console__btn--primary"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="gm-console__btn gm-console__btn--danger"
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
                  className="gm-console__editor gm-console__editor--new"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      flash(
                        await gmUpdateRuleAction({
                          challengeId,
                          sortOrder: Number(
                            fd.get("sortOrder") ||
                              challenge.rules.length + 1,
                          ),
                          title: String(fd.get("title") ?? ""),
                          body: String(fd.get("body") ?? ""),
                          isCore: fd.get("isCore") === "on",
                        }),
                      );
                      e.currentTarget.reset();
                    });
                  }}
                >
                  <p className="gm-console__panel-kicker">Add rule</p>
                  <div className="gm-console__grid gm-console__grid--2">
                    <label className="gm-console__field">
                      <span className="gm-console__label">Order</span>
                      <input
                        name="sortOrder"
                        type="number"
                        placeholder="Order"
                        className="gm-console__input"
                      />
                    </label>
                    <label className="gm-console__field">
                      <span className="gm-console__label">Title</span>
                      <input
                        name="title"
                        placeholder="Title"
                        required
                        className="gm-console__input"
                      />
                    </label>
                  </div>
                  <label className="gm-console__field">
                    <span className="gm-console__label">Body</span>
                    <textarea
                      name="body"
                      placeholder="Body"
                      required
                      className="gm-console__textarea"
                    />
                    <MarkdownHint />
                  </label>
                  <label className="gm-console__check">
                    <input name="isCore" type="checkbox" /> Core rule
                  </label>
                  <div className="gm-console__actions">
                    <button
                      type="submit"
                      disabled={pending}
                      className="gm-console__btn gm-console__btn--accent"
                    >
                      Add rule
                    </button>
                  </div>
                </form>
              </div>
            </Panel>
          ) : null}

          {tab === "faq" ? (
            <Panel
              kicker="04 · Content"
              title="FAQ"
              description="Questions and answers on the season FAQ page."
            >
              <div className="space-y-3">
                {challenge.faqs.map((faq) => (
                  <form
                    key={faq.id}
                    className="gm-console__editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        flash(
                          await gmUpdateFaqAction({
                            challengeId,
                            faqId: faq.id,
                            sortOrder: Number(
                              fd.get("sortOrder") || faq.sortOrder,
                            ),
                            question: String(fd.get("question") ?? ""),
                            answer: String(fd.get("answer") ?? ""),
                          }),
                        );
                      });
                    }}
                  >
                    <label className="gm-console__field">
                      <span className="gm-console__label">Order</span>
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={faq.sortOrder}
                        className="gm-console__input sm:max-w-[6rem]"
                      />
                    </label>
                    <label className="gm-console__field">
                      <span className="gm-console__label">Question</span>
                      <input
                        name="question"
                        defaultValue={faq.question}
                        className="gm-console__input"
                      />
                    </label>
                    <label className="gm-console__field">
                      <span className="gm-console__label">Answer</span>
                      <textarea
                        name="answer"
                        defaultValue={faq.answer}
                        className="gm-console__textarea"
                      />
                      <MarkdownHint />
                    </label>
                    <div className="gm-console__actions">
                      <button
                        type="submit"
                        disabled={pending}
                        className="gm-console__btn gm-console__btn--primary"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="gm-console__btn gm-console__btn--danger"
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
                  className="gm-console__editor gm-console__editor--new"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      flash(
                        await gmUpdateFaqAction({
                          challengeId,
                          sortOrder: Number(
                            fd.get("sortOrder") ||
                              challenge.faqs.length + 1,
                          ),
                          question: String(fd.get("question") ?? ""),
                          answer: String(fd.get("answer") ?? ""),
                        }),
                      );
                      e.currentTarget.reset();
                    });
                  }}
                >
                  <p className="gm-console__panel-kicker">Add FAQ</p>
                  <label className="gm-console__field">
                    <span className="gm-console__label">Question</span>
                    <input
                      name="question"
                      placeholder="Question"
                      required
                      className="gm-console__input"
                    />
                  </label>
                  <label className="gm-console__field">
                    <span className="gm-console__label">Answer</span>
                    <textarea
                      name="answer"
                      placeholder="Answer"
                      required
                      className="gm-console__textarea"
                    />
                    <MarkdownHint />
                  </label>
                  <div className="gm-console__actions">
                    <button
                      type="submit"
                      disabled={pending}
                      className="gm-console__btn gm-console__btn--accent"
                    >
                      Add FAQ
                    </button>
                  </div>
                </form>
              </div>
            </Panel>
          ) : null}

          {tab === "feedback" && (
            <Panel
              description="Player bug reports, feature requests, and support questions."
              kicker="05 · Inbox"
              title="Feedback"
              trailing={
                <span className="gm-console__chip">
                  {openFeedbackCount} open
                </span>
              }
            >
              {feedbackSubmissions.length === 0 ? (
                <p className="gm-console__hint">No player feedback yet.</p>
              ) : (
                <ol className="space-y-3">
                  {feedbackSubmissions.map((submission) => (
                    <li key={submission.id}>
                      <form
                        className="gm-console__editor"
                        key={`${submission.id}-${submission.status}-${submission.updatedAt}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          startTransition(async () => {
                            try {
                              flash(
                                await updateFeedbackStatusAction({
                                  challengeId,
                                  gmNote: String(data.get("gmNote") ?? ""),
                                  status: String(data.get("status")),
                                  submissionId: submission.id,
                                }),
                              );
                            } catch (error) {
                              flash({
                                error: displayActionError(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not update feedback",
                                ),
                                ok: false,
                              });
                            }
                          });
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="gm-console__panel-kicker">
                              {feedbackCategoryLabel(submission.category)} ·{" "}
                              {submission.requesterName} ·{" "}
                              {formatFeedbackDate(submission.createdAt)}
                            </p>
                            <h3 className="mt-1 font-bold tracking-tight">
                              {submission.subject}
                            </h3>
                          </div>
                          <span
                            className={`rounded-lg border px-2 py-1 text-xs font-bold ${feedbackStatusClass(submission.status)}`}
                          >
                            {feedbackStatusLabel(submission.status)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                          {submission.message}
                        </p>
                        <label className="gm-console__field">
                          <span className="gm-console__label">
                            Shared note (visible to the player)
                          </span>
                          <textarea
                            className="gm-console__textarea"
                            data-testid={`feedback-note-${submission.id}`}
                            defaultValue={submission.gmNote ?? ""}
                            disabled={pending}
                            maxLength={2000}
                            name="gmNote"
                            placeholder="Thanks for reporting — fixed in https://github.com/…"
                            rows={3}
                          />
                        </label>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="gm-console__field min-w-40 flex-1 sm:max-w-52">
                            <span className="gm-console__label">Status</span>
                            <select
                              className="gm-console__select"
                              data-testid={`feedback-status-${submission.id}`}
                              defaultValue={submission.status}
                              disabled={pending}
                              name="status"
                            >
                              {FEEDBACK_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {feedbackStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="gm-console__btn gm-console__btn--primary"
                            data-testid={`feedback-status-update-${submission.id}`}
                            disabled={pending}
                            type="submit"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          {tab === "ops" ? (
            <div className="gm-console__ops-grid">
              <Panel
                kicker="06 · Ops"
                title="Export"
                description="Full season backup — trainers, badges, Pokémon, rules, and FAQ."
              >
                <div className="gm-console__actions">
                  <button
                    type="button"
                    disabled={pending}
                    className="gm-console__btn gm-console__btn--primary"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await gmExportChallengeAction({
                          challengeId,
                          format: "json",
                        });
                        if (!result.ok) {
                          flash(result);
                          return;
                        }
                        downloadTextFile(
                          result.filename,
                          result.content,
                          result.mimeType,
                        );
                        flash({
                          ok: true,
                          message: "JSON export downloaded",
                        });
                      });
                    }}
                  >
                    Download JSON
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="gm-console__btn"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await gmExportChallengeAction({
                          challengeId,
                          format: "csv",
                        });
                        if (!result.ok) {
                          flash(result);
                          return;
                        }
                        downloadTextFile(
                          result.filename,
                          result.content,
                          result.mimeType,
                        );
                        flash({
                          ok: true,
                          message: "CSV export downloaded",
                        });
                      });
                    }}
                  >
                    Download CSV
                  </button>
                </div>
              </Panel>

              <Panel
                kicker="06 · Ops"
                title="Reconstruct memorial history"
                description="Backfill missing R.I.P. entries from each trainer’s retained board snapshots (wipe / import / reset). Existing graves stay; duplicates are skipped."
              >
                <button
                  type="button"
                  disabled={pending}
                  className="gm-console__btn gm-console__btn--primary"
                  onClick={() => {
                    void (async () => {
                      const preview = await previewSeasonMemorialBackfillAction({
                        challengeId,
                      });
                      if (!preview.ok) {
                        flash(preview);
                        return;
                      }
                      if (preview.totalCandidates === 0) {
                        flash({
                          ok: true,
                          message:
                            "No missing memorial entries found in retained board history",
                        });
                        return;
                      }

                      const sample = preview.trainers
                        .slice(0, 6)
                        .map((t) => {
                          const names = t.sample.join(", ");
                          return `${t.handle}: ${t.count}${
                            names ? ` (${names})` : ""
                          }`;
                        })
                        .join(" · ");
                      const extra =
                        preview.trainers.length > 6
                          ? ` · +${preview.trainers.length - 6} trainers`
                          : "";

                      const ok = await confirm({
                        title: "Reconstruct memorial history?",
                        description: (
                          <>
                            Restores {preview.totalCandidates} missing R.I.P.
                            entr
                            {preview.totalCandidates === 1 ? "y" : "ies"} across{" "}
                            {preview.trainersAffected} trainer
                            {preview.trainersAffected === 1 ? "" : "s"} from
                            retained board history. Live memorials are not
                            cleared.
                            <span className="mt-2 block text-muted">
                              {sample}
                              {extra}
                            </span>
                          </>
                        ),
                        confirmLabel: `Restore ${preview.totalCandidates}`,
                        tone: "primary",
                      });
                      if (!ok) return;
                      startTransition(async () => {
                        flash(
                          await gmReconstructMemorialHistoryAction({
                            challengeId,
                          }),
                        );
                      });
                    })();
                  }}
                >
                  Reconstruct memorial history
                </button>
              </Panel>

              <Panel
                kicker="Danger zone"
                title="Season start reset"
                description="Clears every board for an official fresh start. Profiles and claims stay; a history snapshot is saved first."
                danger
              >
                <button
                  type="button"
                  disabled={pending}
                  className="gm-console__btn gm-console__btn--danger-solid"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: "Reset all trainer boards?",
                        description: (
                          <>
                            This clears living parties, memorials, badges, wipe
                            counts, and revive tokens for all{" "}
                            {challenge.trainers.length} trainer
                            {challenge.trainers.length === 1 ? "" : "s"}.
                            Profiles and claims stay. A history snapshot is
                            saved for each board first. Export a backup if you
                            may need the live boards elsewhere.
                          </>
                        ),
                        confirmLabel: "Reset all boards",
                        tone: "danger",
                      });
                      if (!ok) return;
                      startTransition(async () => {
                        flash(
                          await gmResetAllTrainerBoardsAction({ challengeId }),
                        );
                      });
                    })();
                  }}
                >
                  Reset all boards
                </button>
              </Panel>
            </div>
          ) : null}
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}

function MarkdownHint() {
  return (
    <span className="gm-console__hint">
      Markdown supported: <code>**bold**</code>, <code>_italics_</code>, lists,
      links, and tables.
    </span>
  );
}
