import Image from "next/image";
import type { BadgeDefinition } from "@/lib/challenge-types";
import { getEmeraldBadgeMeta } from "@/lib/emerald-badges";
import { trainerSpriteUrl } from "@/lib/sprites";

type BadgeCaseProps = {
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
};

function BadgeMedallion({
  accent,
  shortName,
  earned,
  size = "md",
}: {
  accent: string;
  shortName: string;
  earned: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[7px]" : "h-9 w-9 text-[8px]";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-full border-2 font-display font-bold tracking-wide uppercase ${
        earned ? "text-[#1e2a24]" : "text-muted opacity-70"
      }`}
      style={{
        background: earned
          ? `radial-gradient(circle at 35% 30%, #fff6d5, ${accent})`
          : "var(--surface-2)",
        borderColor: earned ? accent : "var(--frame)",
        boxShadow: earned ? `inset 0 0 0 1px #fff8, 0 1px 0 ${accent}` : undefined,
      }}
      aria-hidden
    >
      {shortName.slice(0, 3)}
    </span>
  );
}

export function BadgeCase({ badges, earnedKeys, compact = false }: BadgeCaseProps) {
  const earned = new Set(earnedKeys);

  if (compact) {
    return (
      <ul
        className="grid grid-cols-7 gap-1.5"
        aria-label="Badge case"
      >
        {badges.map((badge) => {
          const on = earned.has(badge.key);
          const meta = getEmeraldBadgeMeta(badge.key);
          const short =
            meta?.shortName ??
            badge.label.replace("Gym ", "G").replace("Elite ", "E").replace("Championship", "C").replace("Champion", "C");
          return (
            <li
              key={badge.key}
              title={`${meta?.badgeName ?? badge.label}${badge.leaderName ? ` — ${badge.leaderName}` : ""}`}
              className={`flex flex-col items-center justify-center rounded-sm border-2 border-frame px-0.5 py-1.5 ${
                on
                  ? "bg-accent-2/30 shadow-[inset_0_0_0_2px_#e8c56a]"
                  : "bg-surface-2 opacity-55"
              }`}
            >
              {meta ? (
                <BadgeMedallion
                  accent={meta.accent}
                  shortName={meta.shortName}
                  earned={on}
                  size="sm"
                />
              ) : (
                <span className="font-display text-[10px] font-bold uppercase">
                  {short.slice(0, 3)}
                </span>
              )}
              <span className="sr-only">{on ? "earned" : "not earned"}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
      aria-label="Badge case"
    >
      {badges.map((badge) => {
        const on = earned.has(badge.key);
        const meta = getEmeraldBadgeMeta(badge.key);
        const title = meta?.badgeName ?? badge.label;
        const leader = badge.leaderName ?? meta?.shortName;
        return (
          <li
            key={badge.key}
            className={`flex items-center gap-2 rounded-sm border-2 border-frame p-2 ${
              on
                ? "bg-accent-2/30 shadow-[inset_0_0_0_2px_#e8c56a]"
                : "bg-surface-2 opacity-60"
            }`}
          >
            {meta ? (
              <Image
                src={trainerSpriteUrl(meta.leaderSpriteKey)}
                alt=""
                width={48}
                height={48}
                className="pixelated h-12 w-12 shrink-0 object-contain"
                unoptimized
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {meta ? (
                  <BadgeMedallion
                    accent={meta.accent}
                    shortName={meta.shortName}
                    earned={on}
                    size="sm"
                  />
                ) : null}
                <p className="truncate font-display text-xs font-bold tracking-wide uppercase">
                  {title}
                </p>
              </div>
              {leader ? (
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {leader}
                  {meta?.city ? ` · ${meta.city}` : ""}
                </p>
              ) : null}
            </div>
            <span className="sr-only">{on ? "earned" : "not earned"}</span>
          </li>
        );
      })}
    </ul>
  );
}
