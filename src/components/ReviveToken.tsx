type ReviveTokenProps = {
  used: boolean;
  size?: "chip" | "sm" | "md";
  className?: string;
};

export function ReviveToken({
  used,
  size = "md",
  className = "",
}: ReviveTokenProps) {
  const chip = size === "chip";
  const compact = size === "sm";
  return (
    <div
      className={`inline-flex items-center border ${
        chip
          ? "h-5 gap-1 rounded-md px-1.5"
          : compact
            ? "h-8 gap-1.5 rounded-lg px-2.5"
            : "h-8 gap-2 rounded-lg px-3"
      } ${
        used
          ? "border-danger/25 bg-danger/10 text-danger"
          : "border-accent/30 bg-accent/10 text-accent-deep"
      } ${className}`}
      role="status"
    >
      <span
        className={`rounded-full ${
          chip ? "h-1.5 w-1.5" : compact ? "h-2 w-2" : "h-2.5 w-2.5"
        } ${used ? "bg-danger" : "bg-accent"}`}
        aria-hidden
      />
      <span
        className={`font-semibold tracking-tight ${
          chip ? "text-[10px] leading-none" : compact ? "text-[11px]" : "text-sm"
        }`}
      >
        Revive {used ? "used" : "ready"}
      </span>
    </div>
  );
}
