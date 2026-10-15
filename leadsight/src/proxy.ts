import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Paths reachable without a session. /api/log stays public so the login page can report errors.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/log"];

/**
 * Optimistic gate: only checks that a session cookie exists. Full validation
 * happens in getAuthUser() inside each route and in the dashboard layout.
 */
export function proxy(request: NextRequest) {
  if (process.env.DISABLE_AUTH === "true") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (getSessionCookie(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
