import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import DisclaimerClient from './DisclaimerClient';

const description =
  'Vatsa AI uses generative AI and large language models. Read important limitations on AI-generated content, professional advice, and user responsibility.';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description,
  alternates: { canonical: `${SITE_URL}/disclaimer` },
  openGraph: {
    title: 'Disclaimer | Vatsa AI',
    description,
    url: `${SITE_URL}/disclaimer`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Disclaimer | Vatsa AI',
    description,
  },
};

export default function DisclaimerPage() {
  return (
    <>
      <OrganizationJsonLd />
      <DisclaimerClient />
    </>
  );
}
