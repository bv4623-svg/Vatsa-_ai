import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import RefundClient from './RefundClient';

const description =
  'Vatsa AI refund policy: every paid plan gets a full 7-day refund window from the charge date, provided the paid features have not been used since payment.';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description,
  alternates: { canonical: `${SITE_URL}/refund` },
  openGraph: {
    title: 'Refund Policy | Vatsa AI',
    description,
    url: `${SITE_URL}/refund`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Refund Policy | Vatsa AI',
    description,
  },
};

export default function RefundPage() {
  return (
    <>
      <OrganizationJsonLd />
      <RefundClient />
    </>
  );
}
