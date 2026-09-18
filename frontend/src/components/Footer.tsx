import Link from 'next/link';
import { AIIcon } from '@/components/brand/AIIcon';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur-md text-gray-300 py-8 px-6 md:px-12 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <AIIcon size={32} />
          <span className="text-xl font-semibold text-white">Vatsa AI</span>
        </div>

        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" aria-label="Footer navigation">
          <Link href="/privacy" className="hover:text-white transition-colors duration-200">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors duration-200">
            Terms of Service
          </Link>
          <Link href="/cookies" className="hover:text-white transition-colors duration-200">
            Cookie Policy
          </Link>
          <Link href="/pricing" className="hover:text-white transition-colors duration-200">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors duration-200">
            Contact
          </Link>
        </nav>

        <div className="flex gap-4 text-sm font-medium">
          <a
            href="https://github.com/vatsa-ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="hover:text-white transition-colors duration-200"
          >
            GitHub
          </a>
          <a
            href="https://twitter.com/vatsa_ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="hover:text-white transition-colors duration-200"
          >
            Twitter
          </a>
          <a
            href="https://linkedin.com/company/vatsa-ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="hover:text-white transition-colors duration-200"
          >
            LinkedIn
          </a>
        </div>

        <div className="text-xs text-gray-500 text-center md:text-right">
          &copy; {currentYear} Vatsa AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}