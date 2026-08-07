/** Primary / secondary playstyle tags — shared by the details modal and the Pokédex. */
export function PlaystyleChips({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="info-chip text-xs font-semibold">{primary}</span>
      {secondary && (
        <span className="info-chip text-xs font-semibold text-muted">
          {secondary}
        </span>
      )}
    </div>
  );
}
