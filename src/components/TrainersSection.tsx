"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Challenge, TrainerProfile } from "@/lib/challenge-types";
import { TrainerCard } from "@/components/TrainerCard";

const VIEW_STORAGE_KEY = "nuzlocke-trainers-view";
const VIEW_CHANGE_EVENT = "nuzlocke-trainers-view";

type TrainersView = "list" | "grid";

type TrainersSectionProps = {
  challenge: Challenge;
  trainers: TrainerProfile[];
  /** Highlight the signed-in player's card. */
  myTrainerId?: string | null;
  /** Trainer ids whose competitive details the viewer may see (owner / GM). */
  competitiveTrainerIds?: string[];
};

function readView(): TrainersView {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // ignore
  }
  return "list";
}

function subscribeView(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === VIEW_STORAGE_KEY || event.key === null) onStoreChange();
  };
  const onCustom = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(VIEW_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VIEW_CHANGE_EVENT, onCustom);
  };
}

function writeView(next: TrainersView) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
}

export function TrainersSection({
  challenge,
  trainers,
  myTrainerId = null,
  competitiveTrainerIds = [],
}: TrainersSectionProps) {
  const view = useSyncExternalStore<TrainersView>(
    subscribeView,
    readView,
    () => "list",
  );
  const competitiveIds = new Set(competitiveTrainerIds);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">
            This Season&apos;s Trainers
          </h2>
          <p className="mt-1 text-xs text-muted">
            {trainers.length} trainer{trainers.length === 1 ? " has" : "s have"}{" "}
            joined this league!
          </p>
        </div>
        <div
          role="group"
          aria-label="Trainer layout"
          className="gba-inset inline-flex gap-1 bg-surface-2/80 p-1"
        >
          <ViewToggle
            active={view === "list"}
            label="List"
            onClick={() => writeView("list")}
            icon={<ListIcon />}
          />
          <ViewToggle
            active={view === "grid"}
            label="Grid"
            onClick={() => writeView("grid")}
            icon={<GridIcon />}
          />
        </div>
      </div>

      <div
        className={
          view === "grid"
            ? "grid grid-cols-2 gap-3 md:gap-4"
            : "grid gap-4"
        }
      >
        {trainers.map((trainer) => (
          <TrainerCard
            key={trainer.id}
            challenge={challenge}
            trainer={trainer}
            variant={view}
            isYou={myTrainerId != null && trainer.id === myTrainerId}
            showCompetitiveDetails={competitiveIds.has(trainer.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ViewToggle({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
        active
          ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
          : "border-transparent text-ink hover:bg-surface"
      }`}
    >
      <span className={active ? "text-interactive" : "text-ink/70"} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </svg>
  );
}
