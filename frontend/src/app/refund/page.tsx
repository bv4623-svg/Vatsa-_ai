import { Metadata } from 'next';
import RefundClient from './RefundClient';

export const metadata: Metadata = {
  title: 'Refund Policy | Vatsa AI',
  description: 'Vatsa AI refund policy: monthly plans get a 7-day refund window if unused, annual plans get a 14-day refund window.',
};

export default function RefundPage() {
  return <RefundClient />;
}