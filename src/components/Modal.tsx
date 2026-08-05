"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title: ReactNode;
  /** Optional line under the title (species · Lv, etc.). */
  subtitle?: ReactNode;
  /** Extra controls before Close (e.g. View / Edit toggle). */
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** @deprecated Prefer `size="wide"`. */
  wide?: boolean;
  size?: "default" | "md" | "wide" | "fullscreen";
  /**
   * When true, the body does not scroll — children fill the panel height and
   * manage their own overflow (sticky toolbars + independent results panes).
   */
  containScroll?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  subtitle,
  headerActions,
  onClose,
  children,
  footer,
  wide = false,
  size,
  containScroll = false,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resolvedSize = size ?? (wide ? "wide" : "default");
  const widthClass =
    resolvedSize === "fullscreen"
      ? "sm:max-w-[min(96rem,calc(100vw-1.5rem))]"
      : resolvedSize === "wide"
        ? "sm:max-w-4xl"
        : resolvedSize === "md"
          ? "sm:max-w-2xl"
          : "sm:max-w-xl";
  const heightClass =
    resolvedSize === "fullscreen"
      ? "max-h-[98dvh] sm:h-[min(96dvh,56rem)]"
      : "max-h-[92dvh]";

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open || typeof document === "undefined") return null;

  // Portal above sticky rails / overflow parents; sit above body grain (z-80).
  return createPortal(
    <div
      className={`fixed inset-x-0 top-0 z-[100] flex h-dvh items-end justify-center overscroll-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] sm:items-center ${
        resolvedSize === "fullscreen" ? "sm:p-2 lg:p-3" : "sm:p-4"
      }`}
      data-modal-open=""
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        autoFocus
        className={`gba-frame relative z-10 flex w-full flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] outline-none sm:rounded-xl sm:pb-0 ${heightClass} ${widthClass}`}
        onKeyDown={onPanelKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="gba-frame-title relative z-[1] flex shrink-0 items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button
              className="pressable inline-flex min-h-11 min-w-11 items-center justify-center border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        <div
          className={`relative z-[1] flex min-h-0 flex-1 flex-col overscroll-contain ${
            containScroll
              ? "overflow-hidden p-0"
              : "overflow-y-auto p-4 sm:p-5"
          }`}
        >
          {children}
        </div>
        {footer && (
          <footer className="relative z-[1] shrink-0 border-t border-frame/60 bg-surface-2/80 px-4 py-3 sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

type BodyScrollLock = {
  count: number;
  document: Document;
  scrollY: number;
  styles: {
    left: string;
    overflow: string;
    paddingRight: string;
    position: string;
    right: string;
    top: string;
    width: string;
  };
  window: Window;
};

let bodyScrollLock: BodyScrollLock | null = null;

export function lockBodyScroll(
  targetDocument: Document = document,
  targetWindow: Window = window,
) {
  if (bodyScrollLock) {
    bodyScrollLock.count += 1;
    return releaseBodyScroll;
  }

  const { body, documentElement } = targetDocument;
  const scrollY = targetWindow.scrollY;
  const styles = {
    left: body.style.left,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width,
  };
  const scrollbarWidth = Math.max(
    0,
    targetWindow.innerWidth - documentElement.clientWidth,
  );

  body.style.left = "0";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.right = "0";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";

  if (scrollbarWidth > 0) {
    const paddingRight =
      Number.parseFloat(targetWindow.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
  }

  bodyScrollLock = {
    count: 1,
    document: targetDocument,
    scrollY,
    styles,
    window: targetWindow,
  };

  return releaseBodyScroll;
}

function releaseBodyScroll() {
  if (!bodyScrollLock) return;

  bodyScrollLock.count -= 1;
  if (bodyScrollLock.count > 0) return;

  const {
    document: targetDocument,
    scrollY,
    styles,
    window: targetWindow,
  } = bodyScrollLock;
  const { body } = targetDocument;

  body.style.left = styles.left;
  body.style.overflow = styles.overflow;
  body.style.paddingRight = styles.paddingRight;
  body.style.position = styles.position;
  body.style.right = styles.right;
  body.style.top = styles.top;
  body.style.width = styles.width;
  bodyScrollLock = null;
  targetWindow.scrollTo(0, scrollY);
}
