import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, isSupportedLocale } from "@/i18n/locales";
import { isBackendAuthPath, isFrontendPage, isProtectedPage } from "@/lib/proxy/routes";
import { forwardToBackend } from "@/lib/proxy/forward";
import { safeRedirect } from "@/lib/redirect";

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

  // ── Signed-in visitors skip the landing page ───────────────
  // Redirecting here saves downloading and rendering the whole marketing
  // page only for a client effect to bounce them to /home.
  if (path === "/" && request.cookies.get("vatsa_session")?.value) {
    const home = new URL("/home", request.url);
    const response = NextResponse.redirect(home);
    if (isSupportedLocale(langParam)) {
      response.cookies.set(LOCALE_COOKIE, langParam, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return response;
  }

  // ── Signed-in visitors skip sign-in (and its CAPTCHA) ──────
  // Only for real page loads. Next strips its own router headers (rsc,
  // next-router-prefetch) before this runs, so a link prefetch of /login
  // (e.g. "Back to sign in" on the 2FA step) would be redirected too, and
  // that sends the open page to /home mid-typing. In-app navigation is
  // covered by OAuthSignIn itself.
  const isPageLoad = request.headers.get("sec-fetch-dest") === "document";
  if ((path === "/login" || path === "/signup") && isPageLoad && request.cookies.get("vatsa_session")?.value) {
    const target = safeRedirect(url.searchParams.get("redirect"), "/home");
    return NextResponse.redirect(new URL(target, request.url));
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
