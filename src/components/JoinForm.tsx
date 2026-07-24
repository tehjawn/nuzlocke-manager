"use client";

import { useState, useTransition } from "react";
import { joinChallengeAction } from "@/app/actions/challenge";

export function JoinForm({ slug }: { slug: string }) {
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          } else {
            setMessage(null);
            setError(result.error);
          }
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Invite code</span>
        <input
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Player or GM invite"
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
      >
        Join challenge
      </button>
      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </form>
  );
}
