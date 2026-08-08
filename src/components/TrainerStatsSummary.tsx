import type { ReactNode } from "react";
import { formatPokedollars } from "@/lib/gen3-save/money";
import { formatPlayTime } from "@/lib/gen3-save/playtime";
import {
  BadgesIcon,
  CatchFailedIcon,
  CaughtIcon,
  CompletionsIcon,
  MoneyIcon,
  PlayTimeIcon,
  RipIcon,
  RunsIcon,
  UpdatedIcon,
} from "@/components/trainer-stat-icons";

type TrainerStatsSummaryProps = {
  caught: number;
  fallen: number;
  /**
   * Open-slot catch failures with no species on that route (fled / failed / released).
   * Null when save flags have not been imported yet.
   */
  spentRoutes: number | null;
  badgesEarned: number;
  badgesTotal: number;
  /** 1-based attempt on the board right now — the durable count, not closed wipes. */
  runNumber: number;
  /** Run is finished and the next one hasn't started; the board is the final team. */
  runEnded?: boolean;
  /** Championship finishes this season. */
  completions: number;
  money: number | null;
  /** Gen 3 playtime in whole seconds; null when never imported. */
  playTimeSeconds: number | null;
  updatedAt: string | null;
};

function formatUpdatedDay(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TrainerStatsSummary({
  caught,
  fallen,
  spentRoutes,
  badgesEarned,
  badgesTotal,
  runNumber,
  runEnded = false,
  completions,
  money,
  playTimeSeconds,
  updatedAt,
}: TrainerStatsSummaryProps) {
  const badgesComplete = badgesTotal > 0 && badgesEarned === badgesTotal;

  const rows: Array<{
    label: string;
    value: string;
    icon: ReactNode;
    complete?: boolean;
    title?: string;
  }> = [
    {
      label: "Caught",
      value: String(caught),
      icon: <CaughtIcon />,
    },
    {
      label: "R.I.P.",
      value: String(fallen),
      icon: <RipIcon />,
    },
    {
      label: "Catches failed",
      value: spentRoutes != null ? String(spentRoutes) : "—",
      icon: <CatchFailedIcon />,
      title:
        spentRoutes != null
          ? "Routes flagged spent in the save with no owned Pokémon (party, box, or memorial) from that slot. Re-import after progress to refresh."
          : "Import a Modern Emerald save to mark catch-failed routes from encounter flags.",
    },
    {
      label: badgesComplete ? "All badges" : "Badges",
      value: `${badgesEarned}/${badgesTotal}`,
      icon: <BadgesIcon />,
      complete: badgesComplete,
    },
    {
      label: runEnded ? "Run (finished)" : "Run",
      value: String(runNumber),
      icon: <RunsIcon />,
    },
    {
      label: "Completions",
      value: String(completions),
      icon: <CompletionsIcon />,
      complete: completions > 0,
    },
    {
      label: "Money",
      value: money != null ? formatPokedollars(money) : "—",
      icon: <MoneyIcon />,
    },
    {
      label: "Playtime",
      value:
        playTimeSeconds != null ? formatPlayTime(playTimeSeconds) : "—",
      icon: <PlayTimeIcon />,
    },
    {
      label: "Updated",
      value: formatUpdatedDay(updatedAt),
      icon: <UpdatedIcon />,
    },
  ];

  return (
    <dl className="gba-inset divide-y divide-frame/35 overflow-hidden bg-surface-2/70">
      {rows.map((row) => (
        <div
          key={row.label}
          title={row.title}
          className={`flex items-center justify-between gap-3 px-3 py-2 ${
            row.complete ? "trainer-stat--badges-complete" : ""
          }`}
        >
          <dt
            className={`flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight ${
              row.complete ? "text-accent-2-ink" : "text-muted"
            }`}
          >
            <span
              className={`shrink-0 ${
                row.complete ? "text-accent-2-ink" : "text-muted/80"
              }`}
            >
              {row.icon}
            </span>
            {row.label}
          </dt>
          <dd className="shrink-0 text-base font-bold tabular-nums tracking-tight">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
