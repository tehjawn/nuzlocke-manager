type ReviveTokenProps = {
  used: boolean;
};

export function ReviveToken({ used }: ReviveTokenProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-sm border-[3px] border-frame px-3 py-2 ${
        used ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent-deep"
      }`}
      role="status"
    >
      <span
        className={`h-3 w-3 rounded-full border-2 border-frame ${
          used ? "bg-danger" : "bg-accent"
        }`}
        aria-hidden
      />
      <span className="font-display text-sm font-bold tracking-wide uppercase">
        Revive Token {used ? "used" : "ready"}
      </span>
    </div>
  );
}
