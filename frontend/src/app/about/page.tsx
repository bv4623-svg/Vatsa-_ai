import { Metadata } from 'next';
import { BUSINESS } from '@/config/business';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import AboutClient from './AboutClient';

const description = `Vatsa AI is an AI assistant platform based in ${BUSINESS.locality}, on a mission to build the most accessible and intelligent AI platform for everyone.`;

export const metadata: Metadata = {
  title: 'About',
  description,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About | Vatsa AI',
    description,
    url: `${SITE_URL}/about`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | Vatsa AI',
    description,
  },
};

export default function AboutPage() {
  return (
    <>
      <OrganizationJsonLd />
      <AboutClient />
    </>
  );
}
