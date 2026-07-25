"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { uploadCustomAvatarAction } from "@/app/actions/avatar";
import { Modal } from "@/components/Modal";
import { AVATAR_ACCEPT, prepareAvatarFile } from "@/lib/avatar-upload";

type CustomAvatarModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (avatarSpriteKey: string) => void;
};

export function CustomAvatarModal({
  open,
  onClose,
  onSelect,
}: CustomAvatarModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function resetLocal() {
    revokePreview();
    setPreviewUrl(null);
    setPendingFile(null);
    setError(null);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    resetLocal();
    onClose();
  }

  async function onFileChosen(file: File | null) {
    setError(null);
    if (!file) return;
    try {
      const prepared = await prepareAvatarFile(file);
      revokePreview();
      const next = URL.createObjectURL(prepared);
      previewUrlRef.current = next;
      setPendingFile(prepared);
      setPreviewUrl(next);
    } catch (err) {
      setPendingFile(null);
      revokePreview();
      setPreviewUrl(null);
      setError(err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function onUpload() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", pendingFile);
      const result = await uploadCustomAvatarAction(formData);
      if (!result.ok) {
        setError(result.error);
        setUploading(false);
        return;
      }
      onSelect(result.avatarSpriteKey);
      resetLocal();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again");
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      title="Import custom avatar"
      onClose={handleClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="pressable rounded-lg bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!pendingFile || uploading}
            className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-60"
            onClick={onUpload}
          >
            {uploading ? "Uploading…" : "Use image"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Upload a square-ish PNG, JPEG, WebP, or GIF (max 2 MB). We’ll resize it
        to a compact avatar before saving.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="sr-only"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        disabled={uploading}
        className="pressable flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-frame bg-surface-2 px-4 py-8 text-sm disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFileChosen(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 rounded-lg border border-frame bg-surface object-contain"
            unoptimized
          />
        ) : (
          <span className="font-display text-sm font-semibold tracking-tight">
            Drop an image here or browse
          </span>
        )}
        <span className="text-xs text-muted">
          {pendingFile ? pendingFile.name : "Choose file…"}
        </span>
      </button>

      {error ? (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
