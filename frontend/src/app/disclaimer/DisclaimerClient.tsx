import { Metadata } from 'next';
import DisclaimerClient from './DisclaimerClient';

export const metadata: Metadata = {
  title: 'Disclaimer | Vatsa AI',
  description: 'Read the legal disclaimer for Vatsa AI. AI can make mistakes. Verify outputs.',
};

export default function DisclaimerPage() {
  return <DisclaimerClient />;
}