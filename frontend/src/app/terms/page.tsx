import { Metadata } from 'next';
import TermsClient from './TermsClient';

export const metadata: Metadata = {
  title: 'Terms of Service | Vatsa AI',
  description: 'Read the terms and conditions governing the use of Vatsa AI services.',
};

export default function TermsPage() {
  return <TermsClient />;
}