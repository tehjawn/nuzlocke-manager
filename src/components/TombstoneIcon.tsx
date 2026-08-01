type IconProps = { className?: string };

/** Compact tombstone mark for cause-of-death labels. */
export function TombstoneIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        d="M6 20V6.5c0-.8.5-1.5 1.3-1.7L12 3.5l4.7 1.3c.8.2 1.3.9 1.3 1.7V20"
        strokeLinejoin="round"
      />
      <path d="M9.5 10.5h5M9.5 14h5" strokeLinecap="round" />
    </svg>
  );
}
