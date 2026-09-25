import { Metadata } from 'next';
import SecurityClient from './SecurityClient';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Learn how Vatsa AI protects your data. Encryption, authentication, and secure payments.',
};

export default function SecurityPage() {
  return <SecurityClient />;
}