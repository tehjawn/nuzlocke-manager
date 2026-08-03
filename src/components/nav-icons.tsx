/** Shared icons for the primary nav (site header pills + mobile drawer). */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const;

export function SeasonsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16" strokeLinecap="round" />
      <path d="M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}

export function AboutIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 7.75v.5" strokeLinecap="round" />
    </svg>
  );
}

export function RulesIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M7 4.5h8.5L18 7v12.5H7A1.5 1.5 0 015.5 18V6A1.5 1.5 0 017 4.5z"
        strokeLinejoin="round"
      />
      <path d="M15.5 4.5V7H18" strokeLinejoin="round" />
      <path d="M9 11h6M9 14.5h6M9 18h3.5" strokeLinecap="round" />
    </svg>
  );
}

export function MyTrainerIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19c.8-3 3.2-4.5 6.5-4.5s5.7 1.5 6.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

export function PreferencesIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FeedbackIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5.5 5.5A2.5 2.5 0 018 3h8a2.5 2.5 0 012.5 2.5v7A2.5 2.5 0 0116 15H11l-4.5 4v-4.5a2.5 2.5 0 01-1-2v-7z"
        strokeLinejoin="round"
      />
      <path d="M9 7.5h6M9 11h4" strokeLinecap="round" />
    </svg>
  );
}

export function GmIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 3.5l6.5 2.2v5c0 4-2.7 7-6.5 8.3-3.8-1.3-6.5-4.3-6.5-8.3v-5L12 3.5z"
        strokeLinejoin="round"
      />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Map / checklist mark for the Game Guide deep link. */
export function GuideIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5.5 5.5l4.5-1.5 4 1.5 4.5-1.5v14.5l-4.5 1.5-4-1.5-4.5 1.5V5.5z"
        strokeLinejoin="round"
      />
      <path d="M10 4.5v14M14 5.5v14" strokeLinecap="round" />
      <path d="M7.5 10.5h1.5M7.5 13.5h1.5" strokeLinecap="round" />
    </svg>
  );
}
