"use client";

import { MoveLabel } from "@/components/MoveLabel";
import {
  modernEmeraldLearnsetFor,
  type MachineMove,
} from "@/lib/modern-emerald-learnsets";

type ModernEmeraldLearnsetProps = {
  pokedexId: number;
};

export function ModernEmeraldLearnset({
  pokedexId,
}: ModernEmeraldLearnsetProps) {
  const learnset = modernEmeraldLearnsetFor(pokedexId);
  if (!learnset) return null;
  const total =
    learnset.egg.length +
    learnset.levelUp.length +
    learnset.tmHm.length +
    learnset.tutor.length;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-tight text-muted">
          Learnset
        </p>
        <p className="text-[10px] text-muted">
          Modern Emerald · {total} moves
        </p>
      </div>

      {learnset.levelUp.length > 0 && (
        <div className="rounded-lg border border-frame/40 bg-surface-2">
          <GroupHeading count={learnset.levelUp.length} label="Level up" />
          <ul className="grid gap-px border-t border-frame/30 bg-frame/20 sm:grid-cols-2">
            {learnset.levelUp.map(({ level, move }, index) => (
              <li
                className="flex min-w-0 items-center gap-2 bg-surface-2 px-2 py-1.5 text-xs"
                key={`${level}-${move}-${index}`}
              >
                <span className="w-9 shrink-0 font-semibold tabular-nums text-muted">
                  Lv {level}
                </span>
                <MoveLabel className="text-xs" move={move} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-1.5 space-y-1.5">
        {learnset.tmHm.length > 0 && (
          <MachineDisclosure moves={learnset.tmHm} />
        )}
        {learnset.tutor.length > 0 && (
          <MoveDisclosure
            label="Move tutor"
            moves={learnset.tutor}
            testId="learnset-move-tutor"
          />
        )}
        {learnset.egg.length > 0 && (
          <MoveDisclosure
            label="Egg moves"
            moves={learnset.egg}
            testId="learnset-egg-moves"
          />
        )}
      </div>
    </div>
  );
}

function GroupHeading({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <p className="text-[11px] font-semibold text-ink">{label}</p>
      <span className="text-[10px] tabular-nums text-muted">{count}</span>
    </div>
  );
}

function DisclosureShell({
  children,
  count,
  label,
  testId,
}: {
  children: React.ReactNode;
  count: number;
  label: string;
  testId: string;
}) {
  return (
    <details className="group rounded-lg border border-frame/40 bg-surface-2">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 [&::-webkit-details-marker]:hidden"
        data-testid={testId}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
          <span
            aria-hidden
            className="text-[9px] text-muted transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted">{count}</span>
      </summary>
      {children}
    </details>
  );
}

function MachineDisclosure({ moves }: { moves: MachineMove[] }) {
  return (
    <DisclosureShell
      count={moves.length}
      label="TM / HM"
      testId="learnset-tm-hm"
    >
      <ul className="grid gap-px border-t border-frame/30 bg-frame/20 sm:grid-cols-2">
        {moves.map(({ machine, move }) => (
          <li
            className="flex min-w-0 items-center gap-2 bg-surface-2 px-2 py-1.5 text-xs"
            key={`${machine}-${move}`}
          >
            <span className="w-10 shrink-0 font-semibold tabular-nums text-muted">
              {machine}
            </span>
            <MoveLabel className="text-xs" move={move} />
          </li>
        ))}
      </ul>
    </DisclosureShell>
  );
}

function MoveDisclosure({
  label,
  moves,
  testId,
}: {
  label: string;
  moves: string[];
  testId: string;
}) {
  return (
    <DisclosureShell count={moves.length} label={label} testId={testId}>
      <ul className="grid gap-px border-t border-frame/30 bg-frame/20 sm:grid-cols-2">
        {moves.map((move) => (
          <li
            className="min-w-0 bg-surface-2 px-2 py-1.5 text-xs"
            key={move}
          >
            <MoveLabel className="text-xs" move={move} />
          </li>
        ))}
      </ul>
    </DisclosureShell>
  );
}
