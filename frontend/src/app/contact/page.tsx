import { Metadata } from 'next';
import { SITE_URL } from '@/config/site';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import ContactClient from './ContactClient';

const description =
  'Get in touch with the Vatsa AI team about our AI models, enterprise solutions, billing, or support. We respond to every message at the email you provide.';

export const metadata: Metadata = {
  title: 'Contact',
  description,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'Contact | Vatsa AI',
    description,
    url: `${SITE_URL}/contact`,
    siteName: 'Vatsa AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | Vatsa AI',
    description,
  },
};

export default function ContactPage() {
  return (
    <>
      <OrganizationJsonLd />
      <ContactClient />
    </>
  );
}
