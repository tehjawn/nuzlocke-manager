import type { ReactNode } from "react";

type FrameProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "rip";
};

export function Frame({
  title,
  children,
  className = "",
  tone = "default",
}: FrameProps) {
  return (
    <section
      className={`gba-frame overflow-hidden ${tone === "rip" ? "bg-rip" : ""} ${className}`}
    >
      {title ? (
        <header className="gba-frame-title px-3 py-2 text-sm sm:text-base">
          {title}
        </header>
      ) : null}
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}
