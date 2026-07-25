import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AVATAR_MAX_UPLOAD_BYTES } from "@/lib/avatar-upload";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("Sign in required");
        }
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new Error("Avatar uploads are not configured yet");
        }

        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: AVATAR_MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Avatar upload failed";
    const status =
      message === "Sign in required"
        ? 401
        : message === "Avatar uploads are not configured yet"
          ? 503
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
