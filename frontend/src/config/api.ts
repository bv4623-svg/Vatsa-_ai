/**
 * The one place the backend's public origin is resolved. Every fetch,
 * axios client, store and the server-side proxy import API_BASE from here.
 *
 * Set NEXT_PUBLIC_API_URL to the deployed API (e.g. https://api.example.com)
 * in Netlify's environment before building -- it is inlined at build time.
 * NEXT_PUBLIC_API_BASE is the legacy name and is still honoured. With
 * neither set (local development) it falls back to the local API server.
 */
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000"
).replace(/\/+$/, "");
