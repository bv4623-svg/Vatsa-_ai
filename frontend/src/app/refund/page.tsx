import { Metadata } from 'next';
import RefundClient from './RefundClient';

export const metadata: Metadata = {
  title: 'Refund Policy | Vatsa AI',
  description: 'Strict No Refund Policy for Vatsa AI. All sales are final. No cancellations after successful payment.',
};

export default function RefundPage() {
  return <RefundClient />;
}