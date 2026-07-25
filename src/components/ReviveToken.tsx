type ReviveTokenProps = {
  used: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function ReviveToken({
  used,
  size = "md",
  className = "",
}: ReviveTokenProps) {
  const compact = size === "sm";
  return (
    <div
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border ${
        compact ? "px-2.5" : "gap-2 px-3"
      } ${
        used
          ? "border-danger/25 bg-danger/10 text-danger"
          : "border-accent/30 bg-accent/10 text-accent-deep"
      } ${className}`}
      role="status"
    >
      <span
        className={`rounded-full ${compact ? "h-2 w-2" : "h-2.5 w-2.5"} ${
          used ? "bg-danger" : "bg-accent"
        }`}
        aria-hidden
      />
      <span
        className={`font-semibold tracking-tight ${
          compact ? "text-[11px]" : "text-sm"
        }`}
      >
        Revive {used ? "used" : "ready"}
      </span>
    </div>
  );
}
