type StatusLineProps = {
  emoji?: string | null;
  text?: string | null;
  empty?: string;
  className?: string;
};

/** Status text with optional leading emoji. */
export function StatusLine({
  emoji,
  text,
  empty = "No status update yet.",
  className = "",
}: StatusLineProps) {
  const trimmed = text?.trim() ?? "";
  if (!emoji && !trimmed) {
    return <p className={className}>{empty}</p>;
  }

  return (
    <p className={className}>
      {emoji ? (
        <span className="mr-1.5 inline-block text-[1.05em] leading-none" aria-hidden>
          {emoji}
        </span>
      ) : null}
      {trimmed}
    </p>
  );
}
