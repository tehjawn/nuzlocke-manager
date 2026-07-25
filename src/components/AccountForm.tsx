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
  const [previewBroken, setPreviewBroken] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = imageValue.trim();
  const showPreview = previewUrl.length > 0 && !previewBroken;

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
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Bio</span>
        <textarea
          className="min-h-24 w-full rounded-lg border border-frame bg-surface px-3 py-2"
          value={bioValue}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <div className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Avatar URL</span>
        <div className="mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-frame bg-surface-2">
          {showPreview ? (
            // User-supplied URLs may be any host — skip next/image remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Avatar preview"
              className="h-full w-full object-cover"
              onError={() => setPreviewBroken(true)}
            />
          ) : (
            <span className="px-1 text-center text-[10px] font-semibold text-muted">
              {previewUrl ? "Invalid URL" : "No preview"}
            </span>
          )}
        </div>
        <label className="sr-only" htmlFor="account-avatar-url">
          Avatar URL
        </label>
        <input
          id="account-avatar-url"
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
          value={imageValue}
          onChange={(e) => {
            setImage(e.target.value);
            setPreviewBroken(false);
          }}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="pressable rounded-lg bg-accent px-4 py-2 text-xs font-semibold tracking-tight text-[var(--on-accent)] disabled:opacity-60"
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
