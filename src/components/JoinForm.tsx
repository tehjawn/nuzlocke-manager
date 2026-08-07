"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  enterChallengeAction,
  joinChallengeAction,
} from "@/app/actions/challenge";
import { CTA_PRIMARY } from "@/lib/cta";

export function JoinForm({
  slug,
  mode,
  needsInvite,
}: {
  slug: string;
  mode: "enter" | "gm" | "invite";
  needsInvite?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mode === "enter") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={pending}
          className={`${CTA_PRIMARY} disabled:opacity-60`}
          onClick={() => {
            startTransition(async () => {
              const result = await enterChallengeAction({ slug });
              if (result.ok && result.trainerId) {
                setError(null);
                setMessage(result.message ?? "You're in");
                router.push(`/challenges/${slug}/me`);
                router.refresh();
              } else if (result.ok) {
                setMessage(result.message ?? "You're in");
                router.push(`/challenges/${slug}/me`);
                router.refresh();
              } else {
                setMessage(null);
                setError(result.error);
              }
            });
          }}
        >
          Get my trainer board
        </button>
        {message && (
          <p className="text-sm font-semibold text-accent-deep">{message}</p>
        )}
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        {needsInvite && (
          <p className="text-xs text-muted">
            If that fails, this season may require an invite below.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await joinChallengeAction({ slug, inviteCode: code });
          if (result.ok) {
            setError(null);
            setMessage(result.message ?? "Joined");
            router.push(`/challenges/${slug}/me`);
            router.refresh();
          } else {
            setMessage(null);
            setError(result.error);
          }
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">
          {mode === "gm" ? "GM invite code" : "Invite code"}
        </span>
        <input
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={mode === "gm" ? "GM code" : "Season invite"}
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${CTA_PRIMARY} disabled:opacity-60`}
      >
        {mode === "gm" ? "Become Game Master" : "Join with code"}
      </button>
      {message && (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </form>
  );
}
