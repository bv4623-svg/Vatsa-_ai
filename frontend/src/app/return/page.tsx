import { Metadata } from 'next';
import ReturnClient from './ReturnClient';

export const metadata: Metadata = {
  title: 'Return Policy | Vatsa AI',
  description: 'Digital AI products are non-returnable. No physical goods or exchanges.',
};

export default function ReturnPage() {
  return <ReturnClient />;
}