import { BUSINESS, legalName, postalAddress } from "@/config/business";
import { SITE_URL } from "@/config/site";

/** Organization schema.org JSON-LD, identical on every legal/marketing page
 * so search engines see one consistent business identity. */
export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BUSINESS.brandName,
    legalName: legalName(),
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    email: BUSINESS.supportEmail,
    address: {
      "@type": "PostalAddress",
      streetAddress: postalAddress(),
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
