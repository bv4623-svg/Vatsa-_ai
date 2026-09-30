import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import TermsClient from './TermsClient';

const description =
  'The terms and conditions governing your use of Vatsa AI: eligibility, subscriptions, billing, intellectual property, liability limits, and governing law.';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: 'Terms of Service | Vatsa AI',
    description,
    url: `${SITE_URL}/terms`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service | Vatsa AI',
    description,
  },
};

export default function TermsPage() {
  return (
    <>
      <OrganizationJsonLd />
      <TermsClient />
    </>
  );
}
