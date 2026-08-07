"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";

export type ModeTabDef<T extends string = string> = {
  id: T;
  label: ReactNode;
  /** When set, the tab is a soft-nav Link instead of a button. */
  href?: string;
  "data-testid"?: string;
};

export type ModeTabsProps<T extends string = string> = {
  "aria-label": string;
  value: T;
  tabs: ReadonlyArray<ModeTabDef<T>>;
  /** Required for button tabs; ignored for `href` tabs. */
  onValueChange?: (id: T) => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  /** Right-side strip action (e.g. cross-link). */
  trailing?: ReactNode;
  /** Next.js Link `replace` for href tabs. */
  linkReplace?: boolean;
  /** Next.js Link `scroll` for href tabs (default false). */
  linkScroll?: boolean;
  /** Prefix for tab / panel element ids. */
  idPrefix?: string;
  size?: "sm" | "md";
};

/**
 * Chrome-style folder tabs: active tab shares fill with the panel and covers
 * the top border seam so the mode feels attached to its document.
 */
export function ModeTabs<T extends string>({
  "aria-label": ariaLabel,
  value,
  tabs,
  onValueChange,
  children,
  className = "",
  panelClassName = "",
  trailing,
  linkReplace = false,
  linkScroll = false,
  idPrefix,
  size = "md",
}: ModeTabsProps<T>) {
  const reactId = useId();
  const prefix = idPrefix ?? `mode-tabs${reactId}`;
  const panelId = `${prefix}-panel`;
  const sizeClass = size === "sm" ? " mode-tabs--sm" : "";

  return (
    <div className={`mode-tabs${sizeClass} ${className}`.trim()}>
      <div className="mode-tabs__chrome">
        <div role="tablist" aria-label={ariaLabel} className="mode-tabs__list">
          {tabs.map((tab) => {
            const selected = tab.id === value;
            const tabId = `${prefix}-tab-${tab.id}`;
            const shared = {
              id: tabId,
              role: "tab" as const,
              "aria-selected": selected,
              "aria-controls": panelId,
              "data-testid": tab["data-testid"],
              // No `.pressable` — its hover translateY clips inside the strip.
              className: "mode-tabs__tab",
            };

            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  {...shared}
                  prefetch
                  replace={linkReplace}
                  scroll={linkScroll}
                >
                  {tab.label}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                {...shared}
                onClick={() => onValueChange?.(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {trailing && <div className="mode-tabs__trailing">{trailing}</div>}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${prefix}-tab-${value}`}
        className={`mode-tabs__panel ${panelClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
