type ChampionRibbonProps = {
  /** Season Championship clears (`TrainerProfile.completionCount`). */
  completionCount: number;
  /** Tighter band for dense / compact grid cards. */
  dense?: boolean;
  className?: string;
};

/**
 * Corner seal for trainers who have beaten the Championship this season.
 * Decorative chrome — accessible name lives on the card’s board link label.
 */
export function ChampionRibbon({
  completionCount,
  dense = false,
  className = "",
}: ChampionRibbonProps) {
  if (completionCount < 1) return null;

  return (
    <div
      className={`champion-ribbon pointer-events-none ${
        dense ? "champion-ribbon--dense" : ""
      } ${className}`}
      aria-hidden
    >
      <span className="champion-ribbon__band">
        <span className="champion-ribbon__label">Champion</span>
        {completionCount > 1 ? (
          <span className="champion-ribbon__count">×{completionCount}</span>
        ) : null}
      </span>
    </div>
  );
}
