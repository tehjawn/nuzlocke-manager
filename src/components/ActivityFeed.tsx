import type { ActivityItem } from "@/lib/challenge-types";
import { Frame } from "@/components/Frame";

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <Frame title="Clubhouse feed">
      {activities.length === 0 ? (
        <p className="text-sm text-muted">No activity yet. Updates show here.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((item) => (
            <li key={item.id} className="border-b border-frame/20 pb-3 last:border-0">
              <p className="text-sm leading-snug">{item.message}</p>
              <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
                {item.type.replaceAll("_", " ")}
                {" · "}
                {new Date(item.createdAt).toLocaleString()}
                {item.trainerHandle ? ` · ${item.trainerHandle}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
