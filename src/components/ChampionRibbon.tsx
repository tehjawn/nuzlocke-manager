type ChampionRibbonProps = {
  /**
   * Recorded clears (`TrainerProfile.completionCount`) — drives the ×N suffix
   * only. Whether the ribbon shows at all is the caller's call: badges alone
   * earn it, and those trainers sit at 0 recorded completions.
   */
  completionCount?: number;
  /** Tighter band for dense / compact grid cards. */
  dense?: boolean;
  className?: string;
};

/**
 * Corner seal for trainers who have beaten the Championship this season.
 * Decorative chrome — accessible name lives on the card’s board link label.
 */
export function ChampionRibbon({
  completionCount = 0,
  dense = false,
  className = "",
}: ChampionRibbonProps) {
  return (
    <div
      className={`champion-ribbon pointer-events-none ${
        dense ? "champion-ribbon--dense" : ""
      } ${className}`}
      aria-hidden
    >
      <span className="champion-ribbon__band">
        <span className="champion-ribbon__label">Champion</span>
        {completionCount > 1 && (
          <span className="champion-ribbon__count">×{completionCount}</span>
        )}
      </span>
    </div>
  );
}
