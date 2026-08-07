import { Frame } from "@/components/Frame";
import type { DataSource } from "@/lib/challenge-types";

export function DataSourceBanner({ source }: { source: DataSource }) {
  if (source === "database") return null;
  return (
    <Frame>
      <p className="text-sm leading-relaxed">
        <span className="font-display font-bold text-accent-2-ink">Demo mode.</span>{" "}
        Showing seed data. Connect Postgres, run{" "}
        <code className="text-ink">npm run db:seed</code>, and add Discord auth
        env vars to enable login + editing.
      </p>
    </Frame>
  );
}
