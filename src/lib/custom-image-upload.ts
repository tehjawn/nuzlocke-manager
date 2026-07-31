export const CUSTOM_IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const CUSTOM_IMAGE_MAX_EDGE_PX = 1000;

export const CUSTOM_IMAGE_SIZE_ERROR =
  "Image must be 5 MB or smaller after processing";
export const CUSTOM_IMAGE_DIMENSIONS_ERROR =
  "Image must be 1000×1000 pixels or smaller after processing";

export function assertCustomImageSize(file: Blob): void {
  if (file.size > CUSTOM_IMAGE_MAX_UPLOAD_BYTES) {
    throw new Error(CUSTOM_IMAGE_SIZE_ERROR);
  }
}

export function isWithinCustomImageDimensions(
  width: number,
  height: number,
): boolean {
  return (
    width <= CUSTOM_IMAGE_MAX_EDGE_PX &&
    height <= CUSTOM_IMAGE_MAX_EDGE_PX
  );
}
