import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import PrivacyClient from './PrivacyClient';

const description =
  'How Vatsa AI collects, uses, and protects your personal data: account details, chat history, uploaded files, security, and your rights under this policy.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'Privacy Policy | Vatsa AI',
    description,
    url: `${SITE_URL}/privacy`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy | Vatsa AI',
    description,
  },
};

export default function PrivacyPage() {
  return (
    <>
      <OrganizationJsonLd />
      <PrivacyClient />
    </>
  );
}
