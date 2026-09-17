import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, isSupportedLocale } from "@/i18n/locales";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Page routes that must NOT be proxied (frontend lives here)
const FRONTEND_PAGE_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth",           // fallback — /auth/page.tsx
];

// Backend-only paths (even under /auth)
const BACKEND_AUTH_PREFIXES = [
  "/auth/otp",
  "/auth/register",
  "/auth/reset-password",
  "/auth/onboarding",
  "/auth/token",
  "/auth/google",
  "/auth/github",
  "/auth/microsoft",
  "/auth/me",
  "/auth/logout",
  "/auth/refresh",
];

// Pages that require a signed-in user. The bearer token in localStorage is
// still the authority (the backend validates the JWT on every API call);
// the vatsa_session cookie only lets us bounce anonymous visitors here
// instead of flashing an empty authed shell first.
const PROTECTED_PREFIXES = ["/home", "/code", "/workspace", "/checkout", "/billing", "/settings", "/library", "/scheduled", "/projects"];

function isBackendAuthPath(path: string) {
  return BACKEND_AUTH_PREFIXES.some((p) => path.startsWith(p));
}

function isFrontendPage(path: string) {
  // exact match only (so /auth/login/foo still goes to backend if not defined)
  return FRONTEND_PAGE_PREFIXES.some((p) => path === p);
}

function isProtectedPage(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

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

  // ── Build backend URL ──────────────────────────────────────
  const backendUrl = `${BACKEND_URL}${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");

  if (
    !headers.has("content-type") &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      redirect: "manual", // don't follow OAuth redirects inside the proxy
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set(
      "access-control-allow-origin",
      request.headers.get("origin") || "*"
    );
    responseHeaders.set("access-control-allow-credentials", "true");
    responseHeaders.set(
      "access-control-allow-methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    responseHeaders.set(
      "access-control-allow-headers",
      "Content-Type, Authorization, X-Requested-With"
    );

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: responseHeaders });
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("❌ Proxy error:", error);
    return new NextResponse(
      JSON.stringify({
        error: "Backend unreachable",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.mp4$|.*\\.webp$|.*\\.css$).*)",
  ],
};