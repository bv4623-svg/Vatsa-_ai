/** The site's own public origin, no trailing slash. Single source of truth
 * for metadataBase, canonical URLs and JSON-LD -- see app/layout.tsx and
 * components/seo/OrganizationJsonLd.tsx. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vatsaai.netlify.app";
