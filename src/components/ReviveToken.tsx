type ReviveTokenProps = {
  used: boolean;
  size?: "sm" | "md";
};

export function ReviveToken({ used, size = "md" }: ReviveTokenProps) {
  const compact = size === "sm";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-sm border-frame ${
        compact
          ? "border-2 px-2 py-1"
          : "gap-2 border-[3px] px-3 py-2"
      } ${used ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent-deep"}`}
      role="status"
    >
      <span
        className={`rounded-full border-2 border-frame ${
          compact ? "h-2 w-2" : "h-3 w-3"
        } ${used ? "bg-danger" : "bg-accent"}`}
        aria-hidden
      />
      <span
        className={`font-display font-bold tracking-wide uppercase ${
          compact ? "text-[10px]" : "text-sm"
        }`}
      >
        Revive {used ? "used" : "ready"}
      </span>
    </div>
  );
}
