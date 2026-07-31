"use server";

import { put } from "@vercel/blob";
import { requireUserId } from "@/lib/permissions";
import {
  customTextureKey,
  isAllowedTextureMime,
  textureBlobFolder,
  type TextureKind,
} from "@/lib/custom-texture";
import {
  validateImageUpload,
  versionBlobUrl,
} from "@/lib/server-image-upload";

export type UploadCustomTextureResult =
  | { ok: true; textureKey: string }
  | { ok: false; error: string };

function parseKind(raw: FormDataEntryValue | null): TextureKind | null {
  return raw === "avatar-bg" || raw === "card-bg" ? raw : null;
}

export async function uploadCustomTextureAction(
  formData: FormData,
): Promise<UploadCustomTextureResult> {
  try {
    const userId = await requireUserId();
    const kind = parseKind(formData.get("kind"));
    if (!kind) {
      return { ok: false, error: "Unknown texture type" };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return {
        ok: false,
        error:
          "Missing BLOB_READ_WRITE_TOKEN. Add it to .env.local and restart the dev server.",
      };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image to upload" };
    }
    if (!isAllowedTextureMime(file.type)) {
      return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF image" };
    }
    const validationError = await validateImageUpload(file, {
      allowAnimation: false,
    });
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const basename = kind === "avatar-bg" ? "backdrop" : "card";
    const blob = await put(
      `${textureBlobFolder(kind)}/${userId}/${basename}`,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: file.type,
        token,
      },
    );

    return {
      ok: true,
      textureKey: customTextureKey(versionBlobUrl(blob.url)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
