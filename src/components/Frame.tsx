import type { ReactNode } from "react";

type FrameProps = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "rip";
};

export function Frame({
  title,
  actions,
  children,
  className = "",
  tone = "default",
}: FrameProps) {
  return (
    <section
      className={`gba-frame overflow-hidden ${tone === "rip" ? "bg-rip" : ""} ${className}`}
    >
      {title ? (
        <header className="gba-frame-title flex items-center justify-between gap-3 px-3 py-2 text-sm sm:text-base">
          <span className="min-w-0 truncate">{title}</span>
          {actions ? (
            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}
