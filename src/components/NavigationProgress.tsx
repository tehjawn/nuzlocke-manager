"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Phase = "idle" | "pending" | "active" | "done";

/**
 * Top progress bar for App Router navigations.
 * Starts on same-origin <a> clicks; completes when the pathname changes.
 * Delayed show avoids a flash on fast (prefetched) transitions.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const pathnameRef = useRef(pathname);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;

    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }

    setPhase((current) =>
      current === "active" || current === "pending" ? "done" : "idle",
    );
  }, [pathname]);

  useEffect(() => {
    if (phase !== "done") return;
    hideTimer.current = setTimeout(() => setPhase("idle"), 280);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [phase]);

  useEffect(() => {
    function clearShowTimer() {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      clearShowTimer();
      setPhase("pending");
      showTimer.current = setTimeout(() => {
        setPhase("active");
        showTimer.current = null;
      }, 120);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearShowTimer();
    };
  }, []);

  const visible = phase === "active" || phase === "done";

  return (
    <div
      className={`nav-progress${visible ? " is-visible" : ""}${
        phase === "done" ? " is-done" : ""
      }`}
      role="progressbar"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading page"
    >
      <div className="nav-progress-bar" />
    </div>
  );
}
