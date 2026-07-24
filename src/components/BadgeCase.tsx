import type { BadgeDefinition } from "@/lib/challenge-types";

type BadgeCaseProps = {
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
};

export function BadgeCase({ badges, earnedKeys, compact = false }: BadgeCaseProps) {
  const earned = new Set(earnedKeys);

  return (
    <ul
      className={`grid gap-1.5 ${compact ? "grid-cols-7" : "grid-cols-4 sm:grid-cols-7"}`}
      aria-label="Badge case"
    >
      {badges.map((badge) => {
        const on = earned.has(badge.key);
        return (
          <li
            key={badge.key}
            title={`${badge.label}${badge.leaderName ? ` — ${badge.leaderName}` : ""}`}
            className={`flex flex-col items-center justify-center rounded-sm border-2 border-frame px-1 py-2 text-center ${
              on
                ? "bg-accent-2/30 shadow-[inset_0_0_0_2px_#e8c56a]"
                : "bg-surface-2 opacity-55"
            }`}
          >
            <span
              className={`font-display text-[10px] font-bold tracking-wide uppercase sm:text-xs ${
                on ? "text-ink" : "text-muted"
              }`}
            >
              {compact ? badge.label.replace("Gym ", "G").replace("Elite ", "E").replace("Championship", "C") : badge.label}
            </span>
            {!compact && badge.leaderName ? (
              <span className="mt-0.5 hidden text-[10px] text-muted sm:block">
                {badge.leaderName}
              </span>
            ) : null}
            <span className="sr-only">{on ? "earned" : "not earned"}</span>
          </li>
        );
      })}
    </ul>
  );
}
