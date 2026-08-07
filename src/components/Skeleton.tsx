type SkeletonProps = {
  /** Size, shape, and surface tone — always include a bg. */
  className?: string;
};

/**
 * Layout-stable pulse block for progressive-load placeholders.
 * Prefer matching the final content’s height so swaps don’t shift the page.
 */
export function Skeleton({
  className = "h-4 w-full rounded bg-frame/15",
}: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse ${className}`} />;
}
