import { SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";

type PageSkeletonProps = {
  /** Trainer board layout vs GM console vs generic content blocks. */
  variant?: "default" | "board" | "gm";
};

/** Shared route-level loading fallback — keeps shell width consistent. */
export function PageSkeleton({ variant = "default" }: PageSkeletonProps) {
  if (variant === "board") {
    return (
      <div className="flex flex-1 flex-col" aria-hidden>
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 animate-pulse rounded-md bg-frame/20 sm:size-9" />
            <div className="hidden h-5 w-36 animate-pulse rounded bg-frame/15 sm:block" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-frame/15" />
            <div className="hidden h-9 w-20 animate-pulse rounded-lg bg-frame/10 sm:block" />
          </div>
        </div>
        <div
          className={`mx-auto w-full space-y-4 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
        >
          <div className="flex justify-between gap-3">
            <div className="h-10 w-44 animate-pulse rounded-lg bg-frame/20" />
            <div className="h-10 w-32 animate-pulse rounded-lg bg-frame/15" />
          </div>
          <div className="h-4 w-2/3 max-w-md animate-pulse rounded-lg bg-frame/10" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
            <div className="space-y-4">
              <div className="h-48 animate-pulse rounded-lg border border-frame/20 bg-surface" />
              <div className="h-40 animate-pulse rounded-lg border border-frame/20 bg-surface" />
              <div className="h-36 animate-pulse rounded-lg border border-frame/20 bg-surface" />
            </div>
            <div className="h-72 animate-pulse rounded-lg border border-frame/20 bg-surface" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "gm") {
    return (
      <div className="flex flex-1 flex-col" aria-hidden>
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 animate-pulse rounded-md bg-frame/20 sm:size-9" />
            <div className="hidden h-5 w-36 animate-pulse rounded bg-frame/15 sm:block" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-frame/15" />
            <div className="hidden h-9 w-20 animate-pulse rounded-lg bg-frame/10 sm:block" />
          </div>
        </div>
        <div
          className={`mx-auto w-full flex-1 space-y-4 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
        >
          <div className="h-4 w-28 animate-pulse rounded bg-frame/15" />
          <div className="mt-2 h-9 w-64 max-w-full animate-pulse rounded-lg bg-frame/20" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-frame/10" />
          <div className="space-y-4 pt-4">
            <div className="h-44 animate-pulse rounded-lg border border-frame/20 bg-surface" />
            <div className="h-40 animate-pulse rounded-lg border border-frame/20 bg-surface" />
            <div className="h-36 animate-pulse rounded-lg border border-frame/20 bg-surface" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full space-y-4 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      aria-hidden
    >
      <div className="h-8 w-40 animate-pulse rounded-lg bg-frame/15" />
      <div className="h-4 w-2/3 max-w-md animate-pulse rounded-lg bg-frame/10" />
      <div className="space-y-3 pt-2">
        <div className="h-36 animate-pulse rounded-lg border border-frame/20 bg-surface" />
        <div className="h-36 animate-pulse rounded-lg border border-frame/20 bg-surface" />
        <div className="h-36 animate-pulse rounded-lg border border-frame/20 bg-surface" />
      </div>
    </div>
  );
}
