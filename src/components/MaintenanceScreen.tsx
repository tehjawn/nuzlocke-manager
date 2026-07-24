import type { DatabaseHealth } from "@/lib/db-health";
import { Frame } from "@/components/Frame";

type MaintenanceScreenProps = {
  health: Extract<DatabaseHealth, { ok: false }>;
};

export function MaintenanceScreen({ health }: MaintenanceScreenProps) {
  const isSchema = health.kind === "schema_mismatch";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-4">
        <p className="font-display text-center text-xs font-bold tracking-[0.2em] text-accent-deep uppercase">
          Nuzlocke Manager
        </p>
        <Frame title="Under maintenance">
          <div className="space-y-4 text-sm leading-relaxed">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              {isSchema
                ? "Season board needs a quick fix"
                : "Can't reach the season database"}
            </h1>
            <p className="text-muted">
              {isSchema
                ? "A new deploy landed before the database was updated, so live trainer boards are paused instead of showing stale demo data."
                : "The app can't talk to Postgres right now. Live boards are paused until the connection is healthy again."}
            </p>
            <p className="rounded-sm border-2 border-frame/30 bg-surface-2 px-3 py-3 font-bold text-ink">
              Message{" "}
              <span className="text-accent-deep">jawn</span> on Discord and
              we&apos;ll get it sorted.
            </p>
            <p className="text-xs text-muted">
              Schema revision {health.revision}
              {isSchema ? " · migrate/push needed" : " · connection issue"}
            </p>
          </div>
        </Frame>
      </div>
    </div>
  );
}
