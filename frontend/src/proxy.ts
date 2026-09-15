import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Backend URL – read from env or fallback
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Only proxy API, auth, and health requests
  if (
    !path.startsWith("/api") &&
    !path.startsWith("/auth") &&
    !path.startsWith("/health")
  ) {
    return NextResponse.next();
  }

  // Build full backend URL
  const backendUrl = `${BACKEND_URL}${path}${url.search}`;

  // Prepare headers
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");

  // Ensure Content-Type for body requests
  if (
    !headers.has("content-type") &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    headers.set("content-type", "application/json");
  }

  // Forward the request
  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      credentials: "include", // send cookies if any
    });

    // Build response headers
    const responseHeaders = new Headers(response.headers);
    // CORS headers for development
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

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: responseHeaders });
    }

    // Return actual response
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