import { Metadata } from 'next';
import RefundClient from './RefundClient';

export const metadata: Metadata = {
  title: 'Refund Policy | Vatsa AI',
  description: 'Vatsa AI refund policy: every plan gets a 7-day refund window if the paid features have not been used.',
};

export default function RefundPage() {
  return <RefundClient />;
}