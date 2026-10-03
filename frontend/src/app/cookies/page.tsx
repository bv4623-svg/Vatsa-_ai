import Link from 'next/link';
import { Metadata } from 'next';
import { BusinessInfo } from '@/components/business/BusinessInfo';
import { CookieSettingsButton } from '@/components/analytics/CookieSettingsButton';
import { GA_MEASUREMENT_ID } from '@/lib/analytics/config';

// Every cookie the site actually sets. GA's own cookies appear only after
// the visitor accepts analytics.
const COOKIES: { name: string; purpose: string; type: string; duration: string }[] = [
  { name: 'vatsa_session', purpose: 'Keeps you signed in on this browser', type: 'Essential', duration: '7 days' },
  { name: 'access_token', purpose: 'Completes a Google or GitHub sign-in', type: 'Essential', duration: '7 days' },
  { name: 'oauth_state_google, oauth_state_github', purpose: 'Protects Google and GitHub sign-in from forged requests (set on api.vatsaai.com)', type: 'Essential', duration: '10 minutes' },
  { name: 'vatsa_theme', purpose: 'Remembers the light or dark theme you chose', type: 'Essential', duration: '1 year' },
  { name: 'vatsa_locale', purpose: 'Remembers the language you chose', type: 'Essential', duration: '1 year' },
  { name: '_ga', purpose: 'Google Analytics: tells visits from the same browser apart with a random ID', type: 'Analytics (only if you accept)', duration: '2 years' },
  { name: `_ga_${GA_MEASUREMENT_ID.replace(/^G-/, '')}`, purpose: 'Google Analytics: keeps track of the current visit', type: 'Analytics (only if you accept)', duration: '2 years' },
];

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Understand how Vatsa AI uses cookies and how you can manage your preferences.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Cookie Policy
        </h1>
        <p className="text-gray-400 text-lg">Last updated: October 4, 2026</p>

        <div className="space-y-8">
          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">What Are Cookies?</h2>
            <p className="text-gray-300 leading-relaxed">
              Cookies are small text files placed on your device when you visit a website. They are
              widely used to make websites work more efficiently, as well as to provide reporting
              information and personalise your experience. This policy explains how we use cookies on
              the Vatsa AI platform.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl overflow-x-auto">
            <h2 className="text-2xl font-semibold mb-4">Cookies We Use</h2>
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase bg-white/10 rounded-t-lg">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Purpose</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Duration</th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((c, i) => (
                  <tr key={c.name} className={i < COOKIES.length - 1 ? 'border-b border-white/5' : undefined}>
                    <td className="px-4 py-3 font-medium break-words">{c.name}</td>
                    <td className="px-4 py-3">{c.purpose}</td>
                    <td className="px-4 py-3">{c.type}</td>
                    <td className="px-4 py-3">{c.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              Your cookie choice itself is saved in your browser&apos;s local storage (as
              &quot;cookie-consent&quot;), not in a cookie.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Essential Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              These keep you signed in, protect sign-in, and remember the theme and language you
              chose. The Service does not work without them, so they cannot be switched off.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Analytics Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              If you accept analytics cookies, we use Google Analytics 4 to see which pages are
              visited and which features are used, such as signing up, sending a chat message or
              generating an image. It identifies your browser by a random ID, not by your name or
              email, and we never send it your messages or files. Google Analytics does not load at
              all until you accept.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Third‑Party Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              When you sign in with Google or GitHub, or pay through Razorpay, those services may set
              their own cookies on their own pages. We do not control those cookies; their privacy
              policies explain them.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Managing Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              You can turn analytics cookies on or off at any time. Switching them off stops Google
              Analytics and deletes its cookies from this site. You can also block or delete cookies in
              your browser settings, but blocking essential cookies will sign you out.
            </p>
            <CookieSettingsButton />
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Browser Settings</h2>
            <p className="text-gray-300 leading-relaxed">
              Most browsers allow you to control cookies through their settings. You can usually find
              these controls in the &quot;Options&quot; or &quot;Preferences&quot; menu. For more details, visit your
              browser&apos;s help centre. Remember that blocking all cookies may prevent you from
              logging in or using some features.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about our use of cookies, please contact us at:
            </p>
            <BusinessInfo className="mt-3 [&_dt]:text-gray-200 [&_dd]:text-gray-300" />
          </section>
        </div>
      </div>
    </div>
  );
}