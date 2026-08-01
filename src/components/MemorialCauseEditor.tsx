"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateGraveCauseAction } from "@/app/actions/challenge";
import { useSaveStatus } from "@/components/SaveStatus";

type MemorialCauseEditorProps = {
  trainerId: string;
  pokemonId: string;
  causeOfDeath: string | null;
  canEdit: boolean;
};

export function MemorialCauseEditor({
  trainerId,
  pokemonId,
  causeOfDeath,
  canEdit,
}: MemorialCauseEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(causeOfDeath ?? "");
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const save = useSaveStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(causeOfDeath ?? "");

  useEffect(() => {
    if (!editing) {
      setDraft(causeOfDeath ?? "");
      committedRef.current = causeOfDeath ?? "";
    }
  }, [causeOfDeath, editing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    const previous = committedRef.current.trim();
    setEditing(false);
    if (next === previous) {
      setDraft(causeOfDeath ?? "");
      return;
    }

    committedRef.current = next;
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
        committedRef.current = previous;
        setDraft(previous);
        save.markError(result.error);
      }
    });
  }

  if (!canEdit) {
    if (causeOfDeath) {
      return (
        <p
          className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink/90"
          title={causeOfDeath}
        >
          {causeOfDeath}
        </p>
      );
    }
    return (
      <p className="mt-0.5 text-[11px] italic text-muted">Cause unknown</p>
    );
  }

  if (editing) {
    return (
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
            setDraft(committedRef.current);
            setEditing(false);
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="mt-0.5 block w-full rounded text-left text-[11px] leading-snug transition-colors hover:bg-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      onClick={() => setEditing(true)}
      title="Edit cause of death"
    >
      {draft.trim() ? (
        <span className="line-clamp-2 text-ink/90">{draft.trim()}</span>
      ) : (
        <span className="italic text-muted">Add cause of death…</span>
      )}
    </button>
  );
}
