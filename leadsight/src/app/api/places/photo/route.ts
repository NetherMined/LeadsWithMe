import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { PHOTO_NAME_RE } from "@/lib/google/places";

/**
 * GET /api/places/photo?name=<photo resource name>
 * Resolves the photo with the server-side API key and redirects to Google's
 * key-free image URL, so the key never reaches the browser or the database.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!PHOTO_NAME_RE.test(name)) {
    return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Places API not configured" }, { status: 503 });

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const { photoUri } = (await res.json()) as { photoUri?: string };
    if (!photoUri) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const redirect = NextResponse.redirect(photoUri, 302);
    redirect.headers.set("Cache-Control", "private, max-age=3600");
    return redirect;
  } catch (err) {
    console.error("[places/photo] lookup failed:", err);
    return NextResponse.json({ error: "Photo lookup failed" }, { status: 502 });
  }
}
