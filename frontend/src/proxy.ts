import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, isSupportedLocale } from "@/i18n/locales";
import { isBackendAuthPath, isFrontendPage, isProtectedPage } from "@/lib/proxy/routes";
import { forwardToBackend } from "@/lib/proxy/forward";

export default async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;
  // URL wins over every other locale source (see i18n/request.ts): a
  // ?lang= param on any page navigation is persisted to the cookie
  // getRequestConfig reads on the next render, without a [locale]
  // route segment.
  const langParam = url.searchParams.get("lang");

  // ── Gate private pages ─────────────────────────────────────
  if (isProtectedPage(path) && !request.cookies.get("vatsa_session")?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${path}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // ── Decide whether to proxy ────────────────────────────────
  let shouldProxy = false;

  if (path.startsWith("/api") || path.startsWith("/health")) {
    shouldProxy = true;
  } else if (path.startsWith("/auth")) {
    // If it's a frontend page route AND a normal browser nav (HTML) → skip
    if (isFrontendPage(path) && !isBackendAuthPath(path)) {
      shouldProxy = false;
    } else {
      shouldProxy = true;
    }
  }

  if (!shouldProxy) {
    const response = NextResponse.next();
    if (isSupportedLocale(langParam)) {
      response.cookies.set(LOCALE_COOKIE, langParam, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return response;
  }

  return forwardToBackend(request, path, url.search);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.mp4$|.*\\.webp$|.*\\.css$).*)",
  ],
};
