"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { updateGraveCauseAction } from "@/app/actions/challenge";
import { useSaveStatus } from "@/components/SaveStatus";
import { TombstoneIcon } from "@/components/TombstoneIcon";

type MemorialCauseEditorProps = {
  trainerId: string;
  pokemonId: string;
  causeOfDeath: string | null;
  canEdit: boolean;
};

function CauseLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-0.5 ${className}`.trim()}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <TombstoneIcon className="h-2.5 w-2.5 shrink-0" />
        Cause of death
      </p>
      {children}
    </div>
  );
}

export function MemorialCauseEditor({
  trainerId,
  pokemonId,
  causeOfDeath,
  canEdit,
}: MemorialCauseEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(causeOfDeath ?? "");
  const [editing, setEditing] = useState(false);
  const [syncedCause, setSyncedCause] = useState(causeOfDeath);
  const [, startTransition] = useTransition();
  const save = useSaveStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [committed, setCommitted] = useState(causeOfDeath ?? "");

  if (!editing && causeOfDeath !== syncedCause) {
    setSyncedCause(causeOfDeath);
    setDraft(causeOfDeath ?? "");
    setCommitted(causeOfDeath ?? "");
  }

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    const previous = committed.trim();
    setEditing(false);
    if (next === previous) {
      setDraft(causeOfDeath ?? "");
      return;
    }

    setCommitted(next);
    save.markSaving("Saving cause…");
    startTransition(async () => {
      const result = await updateGraveCauseAction({
        trainerId,
        pokemonId,
        causeOfDeath: next || null,
      });
      if (result.ok) {
        save.markSaved(result.message ?? "Cause updated");
        router.refresh();
      } else {
        setCommitted(previous);
        setDraft(previous);
        save.markError(result.error);
      }
    });
  }

  if (!canEdit) {
    if (causeOfDeath) {
      return (
        <CauseLabel>
          <p
            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink/90"
            title={causeOfDeath}
          >
            {causeOfDeath}
          </p>
        </CauseLabel>
      );
    }
    return (
      <CauseLabel>
        <p className="mt-0.5 text-[11px] italic text-muted">Unknown</p>
      </CauseLabel>
    );
  }

  if (editing) {
    return (
      <CauseLabel>
        <textarea
          ref={textareaRef}
          aria-label="Cause of death"
          className="mt-0.5 w-full resize-y rounded border border-frame/50 bg-surface px-1.5 py-1 text-[11px] leading-snug text-ink outline-none focus:border-accent"
          maxLength={500}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(committed);
              setEditing(false);
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      </CauseLabel>
    );
  }

  return (
    <CauseLabel>
      <button
        type="button"
        className="mt-0.5 block w-full rounded text-left text-[11px] leading-snug transition-colors hover:bg-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        onClick={() => setEditing(true)}
        title="Edit cause of death"
      >
        {draft.trim() ? (
          <span className="line-clamp-2 text-ink/90">{draft.trim()}</span>
        ) : (
          <span className="italic text-muted">Add cause…</span>
        )}
      </button>
    </CauseLabel>
  );
}
