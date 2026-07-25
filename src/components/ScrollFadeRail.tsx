"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ScrollFadeRailProps = {
  className?: string;
  scrollClassName?: string;
  children: ReactNode;
};

/**
 * Sticky/scroll rail with soft top/bottom fades when content overflows,
 * so the hard clip at the viewport edge reads as “more below/above.”
 */
export function ScrollFadeRail({
  className = "",
  scrollClassName = "",
  children,
}: ScrollFadeRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const updateFades = useEffectEvent(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 1;
    setShowTop(overflow && scrollTop > 2);
    setShowBottom(overflow && scrollTop + clientHeight < scrollHeight - 2);
  });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(() => updateFades());
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollerRef} className={scrollClassName}>
        <div className="space-y-4">{children}</div>
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-10 bg-gradient-to-b from-[var(--bg)] to-transparent transition-opacity duration-200 ${
          showTop ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-14 bg-gradient-to-t from-[var(--bg)] to-transparent transition-opacity duration-200 ${
          showBottom ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
