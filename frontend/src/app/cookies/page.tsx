import Link from 'next/link';
import { Metadata } from 'next';
import { BusinessInfo } from '@/components/business/BusinessInfo';

export const metadata: Metadata = {
  title: 'Cookie Policy | Vatsa AI',
  description: 'Understand how Vatsa AI uses cookies and how you can manage your preferences.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Cookie Policy
        </h1>
        <p className="text-gray-400 text-lg">Last updated: September 25, 2026</p>

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
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">session_id</td>
                  <td className="px-4 py-3">Maintains your login session</td>
                  <td className="px-4 py-3">Essential</td>
                  <td className="px-4 py-3">Session</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">csrf_token</td>
                  <td className="px-4 py-3">Protects against cross‑site request forgery</td>
                  <td className="px-4 py-3">Essential</td>
                  <td className="px-4 py-3">Session</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">_ga</td>
                  <td className="px-4 py-3">Google Analytics – distinguishes users</td>
                  <td className="px-4 py-3">Analytics</td>
                  <td className="px-4 py-3">2 years</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">_gid</td>
                  <td className="px-4 py-3">Google Analytics – tracks user behaviour</td>
                  <td className="px-4 py-3">Analytics</td>
                  <td className="px-4 py-3">24 hours</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">preferences</td>
                  <td className="px-4 py-3">Stores your UI preferences (e.g., theme)</td>
                  <td className="px-4 py-3">Functional</td>
                  <td className="px-4 py-3">1 year</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">cookie_consent</td>
                  <td className="px-4 py-3">Stores your cookie consent choices</td>
                  <td className="px-4 py-3">Essential</td>
                  <td className="px-4 py-3">1 year</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Essential Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              These cookies are necessary for the Service to function. They enable core features such
              as user authentication, session management, and security. You cannot opt out of these
              cookies as the Service would not work properly without them.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Analytics Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We use analytics cookies (e.g., Google Analytics) to understand how users interact with
              the Service. This helps us improve performance, diagnose issues, and prioritise feature
              development. Data collected is aggregated and anonymised.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Functional Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              These cookies remember your preferences and settings (e.g., language, theme, layout) to
              enhance your experience. They are non‑essential but improve usability.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Preference Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We use preference cookies to remember your choices and customise the Service to your
              liking. For example, we may store your preferred model settings or notification
              preferences.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Third‑Party Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              Some cookies are set by third‑party services we integrate with, such as Google for
              authentication and analytics. These third parties may also set their own cookies. We do
              not control these cookies; please refer to their respective privacy policies for more
              information.
            </p>
          </section>

          <section className="glass rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Managing Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              You can manage your cookie preferences at any time by clicking the &quot;Cookie Settings&quot;
              link in the footer of our website. You can also configure your browser to block or
              delete cookies, but please note that disabling essential cookies may affect the
              functionality of the Service.
            </p>
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