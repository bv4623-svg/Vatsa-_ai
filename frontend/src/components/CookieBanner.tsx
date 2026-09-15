'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

type ConsentStatus = 'accepted' | 'rejected' | 'customized' | null;

interface Preferences {
  analytics: boolean;
  functional: boolean;
  preferences: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  analytics: false,
  functional: false,
  preferences: false,
};

export default function CookieBanner() {
  const [consent, setConsent] = useState<ConsentStatus>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('cookie-consent');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.status) {
          setConsent(parsed.status);
          if (parsed.preferences) {
            setPreferences(parsed.preferences);
          }
        }
      } catch {
        if (stored === 'accepted' || stored === 'rejected') {
          setConsent(stored);
        }
      }
    }
  }, []);

  const saveConsent = useCallback(
    (status: ConsentStatus, prefs?: Preferences) => {
      const data = {
        status,
        preferences: prefs || DEFAULT_PREFERENCES,
      };
      localStorage.setItem('cookie-consent', JSON.stringify(data));
      setConsent(status);
      if (prefs) setPreferences(prefs);
    },
    []
  );

  const handleAcceptAll = () => {
    const allTrue: Preferences = {
      analytics: true,
      functional: true,
      preferences: true,
    };
    saveConsent('accepted', allTrue);
  };

  const handleRejectAll = () => {
    saveConsent('rejected', DEFAULT_PREFERENCES);
  };

  const handleSavePreferences = (prefs: Preferences) => {
    saveConsent('customized', prefs);
    setShowModal(false);
  };

  if (consent !== null) return null;
  if (!mounted) return null;

  return (
    <>
      <div
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-6 md:max-w-md z-50
                   glass rounded-2xl border border-white/10 shadow-2xl p-5 animate-slide-up"
        role="dialog"
        aria-label="Cookie consent banner"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-200 leading-relaxed">
            We use cookies to improve your experience. By continuing, you agree to our use of
            essential cookies and accept our{' '}
            <Link href="/privacy" className="text-blue-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:bg-white/10 transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Reject non-essential cookies"
            >
              Reject Non‑Essential
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:bg-white/10 transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Customize cookie preferences"
            >
              Customize
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Accept all cookies"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>

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
            <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl animate-scale-in">
              <h2 id="cookie-modal-title" className="text-xl font-semibold text-white mb-4">
                Cookie Preferences
              </h2>
              <p className="text-sm text-gray-300 mb-6">
                Choose which types of cookies you allow. Essential cookies are always enabled.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Essential</div>
                    <div className="text-xs text-gray-400">Required for the Service to function</div>
                  </div>
                  <span className="text-sm bg-white/10 px-3 py-1 rounded-full text-gray-300">
                    Always On
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Analytics</div>
                    <div className="text-xs text-gray-400">
                      Help us understand how you use the Service
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        analytics: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all"
                    aria-label="Enable analytics cookies"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Functional</div>
                    <div className="text-xs text-gray-400">
                      Remember your settings and improve usability
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.functional}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        functional: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all"
                    aria-label="Enable functional cookies"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Preferences</div>
                    <div className="text-xs text-gray-400">
                      Store your customisation choices
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.preferences}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        preferences: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all"
                    aria-label="Enable preference cookies"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:bg-white/10 transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSavePreferences(preferences)}
                  className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}