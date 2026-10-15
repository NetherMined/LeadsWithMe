import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { readUserFile } from "@/lib/storage/local";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** GET /api/files/<userId>/<...path> — serves an uploaded file to its owner only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;
  // Another user's file is indistinguishable from a missing one.
  if (segments[0] !== user.id) return notFound();

  try {
    const data = await readUserFile(segments);
    if (!data) return notFound();

    const ext = segments[segments.length - 1].split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        // Uploaded HTML is user/AI generated: render it sandboxed, never with app privileges.
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (err) {
    console.error("[api/files] read failed:", err);
    return NextResponse.json({ error: "Could not read file" }, { status: 500 });
  }
}
