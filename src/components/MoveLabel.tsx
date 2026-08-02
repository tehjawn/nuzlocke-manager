"use client";

import { InfoTip } from "@/components/InfoTip";
import { TypeBadge } from "@/components/TypeBadge";
import { formatMoveMetaTip, lookupMoveMeta } from "@/lib/move-meta";
import { resolveMoveName } from "@/lib/move-names";

type MoveLabelProps = {
  /** Raw or display move name (Crest IDs resolve via resolveMoveName). */
  move: string;
  /**
   * When true, use a non-button tip trigger (safe inside parent cards/buttons).
   */
  embedded?: boolean;
  /** Tighter type badge + text for board slot cards. */
  compact?: boolean;
  className?: string;
};

/**
 * Move chip content: type badge + name, with a thin meta tip when known.
 * Unknown moves render as plain text (no tip).
 */
export function MoveLabel({
  move,
  embedded = false,
  compact = false,
  className = "",
}: MoveLabelProps) {
  const name = resolveMoveName(move) || move;
  const meta = lookupMoveMeta(name);
  const tip = meta ? formatMoveMetaTip(meta) : "";

  const body = (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}
    >
      {meta ? <TypeBadge type={meta.type} size={compact ? "sm" : "md"} /> : null}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );

  if (!tip) return body;

  return (
    <InfoTip tip={tip} embedded={embedded}>
      {body}
    </InfoTip>
  );
}
