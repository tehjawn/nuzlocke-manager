type TrainerStatsSummaryProps = {
  caught: number;
  fallen: number;
  badgesEarned: number;
  badgesTotal: number;
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
  badgesEarned,
  badgesTotal,
  updatedAt,
}: TrainerStatsSummaryProps) {
  const rows = [
    { label: "Caught", value: String(caught) },
    { label: "R.I.P.", value: String(fallen) },
    {
      label: "Badges",
      value: `${badgesEarned}/${badgesTotal}`,
    },
    { label: "Updated", value: formatUpdatedDay(updatedAt) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-sm border-2 border-frame bg-surface-2/70 px-3 py-2"
        >
          <dt className="font-display text-[10px] font-bold tracking-wide text-muted uppercase">
            {row.label}
          </dt>
          <dd className="mt-0.5 font-display text-lg font-extrabold leading-tight">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
