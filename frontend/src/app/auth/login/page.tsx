import { redirect } from "next/navigation";

/** Canonical sign-in now lives at /login. This keeps old bookmarks and any
 * externally configured redirect URLs working. */
export default async function LegacyLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/login?${query}` : "/login");
}
