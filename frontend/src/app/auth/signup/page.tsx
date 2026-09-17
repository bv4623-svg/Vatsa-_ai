import { redirect } from "next/navigation";

/** Canonical sign-up now lives at /signup. */
export default async function LegacySignupRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/signup?${query}` : "/signup");
}
