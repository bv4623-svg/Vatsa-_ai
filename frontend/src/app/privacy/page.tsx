import { Metadata } from 'next';
import PrivacyClient from './PrivacyClient';

export const metadata: Metadata = {
  title: 'Privacy Policy | Vatsa AI',
  description: 'Learn how Vatsa AI collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}