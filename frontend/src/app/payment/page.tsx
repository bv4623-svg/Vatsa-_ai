import { Metadata } from 'next';
import PaymentClient from './PaymentClient';

export const metadata: Metadata = {
  title: 'Payments & Billing',
  description: 'Payment methods, subscription billing, taxes, chargebacks, and fraud protection for Vatsa AI.',
};

export default function PaymentPage() {
  return <PaymentClient />;
}