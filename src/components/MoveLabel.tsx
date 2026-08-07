"use client";

import { InfoTip } from "@/components/InfoTip";
import { TypeBadge } from "@/components/TypeBadge";
import { formatMoveMetaTip, lookupMoveMeta } from "@/lib/move-meta";
import { resolveMoveName } from "@/lib/move-names";

type MoveLabelProps = {
  /** Raw or display move name (Crest IDs resolve via resolveMoveName). */
  move: string;
  className?: string;
};

/**
 * Detailed move chip: type badge + name, with a thin meta tip when known.
 * For board/dashboard cards, prefer plain name + `moveTypeWashStyle` instead.
 */
export function MoveLabel({ move, className = "" }: MoveLabelProps) {
  const name = resolveMoveName(move) || move;
  const meta = lookupMoveMeta(name);
  const tip = meta ? formatMoveMetaTip(meta) : "";

  const body = (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}
    >
      {meta && <TypeBadge type={meta.type} size="sm" />}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );

  if (!tip) return body;

  return <InfoTip tip={tip}>{body}</InfoTip>;
}
