import sharp from "sharp";
import {
  CUSTOM_IMAGE_DIMENSIONS_ERROR,
  CUSTOM_IMAGE_MAX_UPLOAD_BYTES,
  CUSTOM_IMAGE_SIZE_ERROR,
  isWithinCustomImageDimensions,
} from "@/lib/custom-image-upload";

type ValidateImageUploadOptions = {
  allowAnimation: boolean;
};

export async function validateImageUpload(
  file: File,
  { allowAnimation }: ValidateImageUploadOptions,
): Promise<string | null> {
  if (file.size > CUSTOM_IMAGE_MAX_UPLOAD_BYTES) {
    return CUSTOM_IMAGE_SIZE_ERROR;
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, { animated: true }).metadata();

    if (!mimeMatchesFormat(file.type, metadata.format)) {
      return "Image contents do not match the selected file type";
    }

    const width = metadata.autoOrient?.width ?? metadata.width;
    const height =
      metadata.pageHeight ?? metadata.autoOrient?.height ?? metadata.height;
    if (
      width == null ||
      height == null ||
      !isWithinCustomImageDimensions(width, height)
    ) {
      return CUSTOM_IMAGE_DIMENSIONS_ERROR;
    }

    if (!allowAnimation && (metadata.pages ?? 1) > 1) {
      return "Animated backdrops and backgrounds are not supported";
    }

    return null;
  } catch {
    return "Could not read image";
  }
}

export function versionBlobUrl(url: string, version = Date.now()): string {
  const versioned = new URL(url);
  versioned.searchParams.set("v", version.toString(36));
  return versioned.href;
}

function mimeMatchesFormat(mime: string, format: string): boolean {
  switch (mime) {
    case "image/gif":
      return format === "gif";
    case "image/jpeg":
      return format === "jpeg";
    case "image/png":
      return format === "png";
    case "image/webp":
      return format === "webp";
    default:
      return false;
  }
}
