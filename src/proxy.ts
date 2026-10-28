import { NextResponse } from "next/server";
import { auth, authEnabled } from "@/auth";
import { getRole } from "@/lib/members";

const PUBLIC = ["/login", "/api/auth", "/api/events"];

export default auth((req) => {
  if (!authEnabled) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const login = req.auth?.user?.login;
  if (!login) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Checked on every request so removing a member takes effect immediately.
  if (!getRole(login)) return NextResponse.redirect(new URL("/login?error=AccessDenied", req.nextUrl));
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
