'use client';

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  consentSnapshot,
  parseConsent,
  saveConsent,
  subscribeConsent,
  type StoredConsent,
} from '@/lib/analytics/consent';

// The banner and dialog use a dark surface in both themes so the text stays
// readable on light pages. Buttons are 44 px tall for touch.
const BUTTON =
  'min-h-[44px] px-4 text-sm rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none';

/** Asks once whether Google Analytics may run. Essential cookies (sign-in,
 * theme, language) are always on; analytics is off until accepted. The
 * Cookie Policy page reopens the settings through openCookieSettings(). */
export default function CookieBanner() {
  // null on the server and during hydration, so nothing renders until the
  // stored choice is known; "" means no choice saved yet.
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, () => null);
  const consent = useMemo(() => (raw ? parseConsent(raw) : null), [raw]);
  const [analytics, setAnalytics] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const open = () => {
      setAnalytics(parseConsent(consentSnapshot())?.analytics ?? false);
      setShowModal(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const choose = (next: StoredConsent) => {
    saveConsent(next);
    setShowModal(false);
  };

  if (raw === null) return null;

  return (
    <>
      {consent === null && (
        <div
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-6 md:max-w-md z-50
                     rounded-2xl border border-white/10 bg-zinc-900/95 text-zinc-100 backdrop-blur shadow-2xl p-5 animate-slide-up"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-zinc-200">
              We use essential cookies to keep you signed in and remember your settings. With your
              permission, we also use Google Analytics cookies to learn how the site is used. See our{' '}
              <Link href="/cookies" className="text-blue-400 underline-offset-2 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => choose({ status: 'rejected', analytics: false })}
                className={`${BUTTON} border border-white/20 hover:bg-white/10`}
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setAnalytics(false);
                  setShowModal(true);
                }}
                className={`${BUTTON} border border-white/20 hover:bg-white/10`}
              >
                Settings
              </button>
              <button
                onClick={() => choose({ status: 'accepted', analytics: true })}
                className={`${BUTTON} px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium`}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-modal-title"
          >
            <div className="rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100 p-6 max-w-md w-full shadow-2xl animate-scale-in">
              <h2 id="cookie-modal-title" className="text-xl font-semibold mb-4">
                Cookie settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">Essential</div>
                    <div className="text-xs text-zinc-400">
                      Keep you signed in and remember your theme and language
                    </div>
                  </div>
                  <span className="shrink-0 text-sm bg-white/10 px-3 py-1 rounded-full text-zinc-300">
                    Always on
                  </span>
                </div>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <div className="font-medium">Analytics</div>
                    <div className="text-xs text-zinc-400">
                      Google Analytics: which pages are visited and which features are used
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    autoFocus
                    className="w-5 h-5 shrink-0 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    aria-label="Allow analytics cookies"
                  />
                </label>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className={`${BUTTON} border border-white/20 hover:bg-white/10`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => choose({ status: 'customized', analytics })}
                  className={`${BUTTON} px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
