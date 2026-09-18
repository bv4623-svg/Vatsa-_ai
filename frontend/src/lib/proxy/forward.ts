import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCorsOrigin } from "@/lib/proxy/cors";
import { API_BASE } from "@/config/api";

const BACKEND_URL = API_BASE;

/** Forwards one request to the FastAPI backend and relays its response,
 * only ever echoing CORS headers back for an allowlisted Origin (see
 * cors.ts) -- never a wildcard-with-credentials reflection of whatever
 * Origin the caller happened to send. */
export async function forwardToBackend(request: NextRequest, path: string, search: string): Promise<NextResponse> {
  const backendUrl = `${BACKEND_URL}${path}${search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");

  if (!headers.has("content-type") && request.method !== "GET" && request.method !== "HEAD") {
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual", // don't follow OAuth redirects inside the proxy
    });

    const responseHeaders = new Headers(response.headers);
    const allowedOrigin = resolveCorsOrigin(request.headers.get("origin"));
    if (allowedOrigin) {
      responseHeaders.set("access-control-allow-origin", allowedOrigin);
      responseHeaders.set("access-control-allow-credentials", "true");
      responseHeaders.set("access-control-allow-methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      responseHeaders.set("access-control-allow-headers", "Content-Type, Authorization, X-Requested-With");
    }

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
      JSON.stringify({ error: "Backend unreachable", detail: error instanceof Error ? error.message : String(error) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
