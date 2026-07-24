"use client";

import { useState, useTransition } from "react";
import { updateAccountAction } from "@/app/actions/challenge";

export function AccountForm({
  displayName,
  bio,
  image,
}: {
  displayName: string;
  bio: string;
  image: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(displayName);
  const [bioValue, setBio] = useState(bio);
  const [imageValue, setImage] = useState(image);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateAccountAction({
            displayName: name,
            bio: bioValue || null,
            image: imageValue || null,
          });
          if (result.ok) {
            setError(null);
            setMessage(result.message ?? "Saved");
          } else {
            setMessage(null);
            setError(result.error);
          }
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Display name</span>
        <input
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Bio</span>
        <textarea
          className="min-h-24 w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          value={bioValue}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Avatar URL</span>
        <input
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          value={imageValue}
          onChange={(e) => setImage(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
      >
        Save account
      </button>
      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </form>
  );
}
