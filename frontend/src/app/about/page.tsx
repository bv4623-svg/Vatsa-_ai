import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About Vatsa AI',
  description: 'Vatsa AI is an AI assistant platform based in Purnea, Bihar. Our mission is to democratize AI for everyone.',
};

export default function AboutPage() {
  return <AboutClient />;
}