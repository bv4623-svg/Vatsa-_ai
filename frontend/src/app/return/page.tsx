import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import ReturnClient from './ReturnClient';

const description =
  'Vatsa AI is a 100% digital AI platform: our services are delivered instantly and are non-returnable, with no physical goods, shipping, or exchanges involved.';

export const metadata: Metadata = {
  title: 'Return Policy',
  description,
  alternates: { canonical: `${SITE_URL}/return` },
  openGraph: {
    title: 'Return Policy | Vatsa AI',
    description,
    url: `${SITE_URL}/return`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Return Policy | Vatsa AI',
    description,
  },
};

export default function ReturnPage() {
  return (
    <>
      <OrganizationJsonLd />
      <ReturnClient />
    </>
  );
}
