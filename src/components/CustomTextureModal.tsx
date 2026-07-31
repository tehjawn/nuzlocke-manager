"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { uploadCustomTextureAction } from "@/app/actions/texture";
import { Modal } from "@/components/Modal";
import {
  prepareTextureFile,
  TEXTURE_ACCEPT,
  type TextureKind,
} from "@/lib/custom-texture";
import {
  CUSTOM_IMAGE_URL_MAX_LENGTH,
  customImageKeyFromInput,
  normalizeCustomImageUrl,
} from "@/lib/sprites";

type CustomTextureModalProps = {
  open: boolean;
  kind: TextureKind;
  onClose: () => void;
  onSelect: (textureKey: string) => void;
};

const COPY: Record<
  TextureKind,
  { title: string; blurb: string; previewClass: string }
> = {
  "avatar-bg": {
    title: "Import custom backdrop",
    blurb:
      "Upload a PNG, JPEG, WebP, or GIF — we’ll host it — or paste a public HTTPS image URL to store only the link. Uploads are optimized to at most 1000×1000 and 5 MB (first frame only). Transparent PNGs look best.",
    previewClass: "h-24 w-24 object-contain",
  },
  "card-bg": {
    title: "Import custom card background",
    blurb:
      "Upload a PNG, JPEG, WebP, or GIF — we’ll host it — or paste a public HTTPS image URL to store only the link. Uploads are optimized to at most 1000×1000 and 5 MB (first frame only). Landscape images work best.",
    previewClass: "h-24 w-40 object-cover",
  },
};

export function CustomTextureModal({
  open,
  kind,
  onClose,
  onSelect,
}: CustomTextureModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const copy = COPY[kind];

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
    setUrlInput("");
    setError(null);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    resetLocal();
    onClose();
  }

  function clearFileSelection() {
    revokePreview();
    setPreviewUrl(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFileChosen(file: File | null) {
    setError(null);
    if (!file) return;
    try {
      const prepared = await prepareTextureFile(kind, file);
      revokePreview();
      const next = URL.createObjectURL(prepared);
      previewUrlRef.current = next;
      setPendingFile(prepared);
      setPreviewUrl(next);
      setUrlInput("");
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
      formData.set("kind", kind);
      formData.set("file", pendingFile);
      const result = await uploadCustomTextureAction(formData);
      if (!result.ok) {
        setError(result.error);
        setUploading(false);
        return;
      }
      onSelect(result.textureKey);
      resetLocal();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again");
      setUploading(false);
    }
  }

  function onUseUrl() {
    if (uploading) return;
    setError(null);
    const key = customImageKeyFromInput(urlInput);
    if (!key) {
      setError("Paste a public https:// image URL (PNG, JPEG, WebP, or GIF)");
      return;
    }
    onSelect(key);
    resetLocal();
    onClose();
  }

  const urlPreview = normalizeCustomImageUrl(urlInput);
  const canUseUrl = Boolean(urlPreview) && !uploading;
  const canUpload = Boolean(pendingFile) && !uploading;

  return (
    <Modal
      open
      title={copy.title}
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
          {pendingFile ? (
            <button
              type="button"
              disabled={!canUpload}
              className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-60"
              onClick={onUpload}
            >
              {uploading ? "Uploading…" : "Use upload"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canUseUrl}
              className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-60"
              onClick={onUseUrl}
            >
              Use URL
            </button>
          )}
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">{copy.blurb}</p>

      <input
        ref={inputRef}
        type="file"
        accept={TEXTURE_ACCEPT}
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
            width={160}
            height={96}
            className={`rounded-lg border border-frame bg-surface ${copy.previewClass}`}
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

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-frame" aria-hidden />
        or paste a URL
        <span className="h-px flex-1 bg-frame" aria-hidden />
      </div>

      <label className="block text-xs font-semibold tracking-tight text-ink">
        Image URL
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          maxLength={CUSTOM_IMAGE_URL_MAX_LENGTH + 8}
          disabled={uploading}
          placeholder="https://…"
          value={urlInput}
          onChange={(e) => {
            setError(null);
            clearFileSelection();
            setUrlInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onUseUrl();
            }
          }}
          className="mt-1.5 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
      </label>

      {urlPreview && !pendingFile ? (
        <div className="mt-3 flex justify-center">
          <Image
            src={urlPreview}
            alt=""
            width={160}
            height={96}
            className={`rounded-lg border border-frame bg-surface ${copy.previewClass}`}
            unoptimized
          />
        </div>
      ) : null}

      {error && (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
