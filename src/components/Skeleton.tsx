type SkeletonProps = {
  /** Size, shape, and surface tone — always include a bg. */
  className?: string;
  /** Use `span` inside headings / `<p>` so we don’t nest block elements. */
  as?: "div" | "span";
};

/**
 * Layout-stable placeholder with a sweeping shine for progressive loads.
 * Prefer matching the final content’s height so swaps don’t shift the page.
 */
export function Skeleton({
  className = "h-4 w-full rounded bg-frame/15",
  as: Tag = "div",
}: SkeletonProps) {
  return (
    <Tag
      aria-hidden
      className={`skeleton-shine ${Tag === "span" ? "inline-block " : ""}${className}`}
    />
  );
}
