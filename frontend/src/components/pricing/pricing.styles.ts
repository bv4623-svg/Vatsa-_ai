// refactor-deferred: cannot split without behavior change. reason: one CSS template literal injected as a single <style> block; splitting it would reorder cascade rules.
// Extracted verbatim from the original pricing page style block.
export const STYLES = `
          .scroll-reveal {
            opacity: 0;
            transform: translateY(32px);
            transition: opacity 0.7s ease, transform 0.7s ease;
          }
          .scroll-visible {
            opacity: 1;
            transform: translateY(0);
          }
          .gradient-text {
            background: linear-gradient(135deg, #2563eb, #7c3aed, #2563eb);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 4s ease-in-out infinite alternate;
          }
          @keyframes shimmer {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
          .pricing-card {
            transition: all 0.3s ease;
          }
          .pricing-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 20px 40px -12px rgba(0,0,0,0.25);
          }
          .dark .pricing-card:hover {
            box-shadow: 0 20px 40px -12px rgba(255,255,255,0.08);
          }
          .pricing-card-popular {
            border-color: #2563eb;
            box-shadow: 0 8px 30px -8px rgba(37,99,235,0.25);
          }
          .dark .pricing-card-popular {
            box-shadow: 0 8px 30px -8px rgba(37,99,235,0.15);
          }
          .badge-popular {
            background: #2563eb;
            color: #fff;
          }
          .btn-primary {
            background: #2563eb;
            color: #fff;
            transition: all 0.2s ease;
          }
          .btn-primary:hover {
            background: #1d4ed8;
          }
          .btn-outline {
            border: 1px solid #e5e7eb;
            color: #374151;
            transition: all 0.2s ease;
          }
          .btn-outline:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }
          .dark .btn-outline {
            border-color: #374151;
            color: #d1d5db;
          }
          .dark .btn-outline:hover {
            background: #1f2937;
            border-color: #4b5563;
          }
          .btn-current {
            background: #10b981;
            color: #fff;
            cursor: default;
            opacity: 0.8;
          }
          .faq-item {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.2s ease;
          }
          .dark .faq-item {
            border-color: #1f2937;
          }
          .faq-item:hover {
            border-color: #d1d5db;
          }
          .dark .faq-item:hover {
            border-color: #374151;
          }
          .faq-button {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            text-align: left;
            font-weight: 500;
            background: transparent;
            border: none;
            cursor: pointer;
            color: inherit;
            transition: background 0.15s ease;
          }
          .faq-button:hover {
            background: rgba(0,0,0,0.02);
          }
          .dark .faq-button:hover {
            background: rgba(255,255,255,0.02);
          }
          .faq-answer {
            padding: 0 1.25rem 1.25rem 1.25rem;
            color: #6b7280;
            line-height: 1.7;
            font-size: 0.95rem;
          }
          .dark .faq-answer {
            color: #9ca3af;
          }
          .toggle-track {
            width: 44px;
            height: 24px;
            border-radius: 9999px;
            background: #d1d5db;
            position: relative;
            cursor: pointer;
            transition: background 0.25s ease;
            flex-shrink: 0;
          }
          .dark .toggle-track {
            background: #374151;
          }
          .toggle-track.active {
            background: #2563eb;
          }
          .toggle-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            transition: transform 0.25s ease;
          }
          .toggle-track.active .toggle-thumb {
            transform: translateX(20px);
          }
          .footer-link {
            color: #9ca3af;
            transition: color 0.15s ease;
            font-size: 0.8rem;
          }
          .footer-link:hover {
            color: #111827;
          }
          .dark .footer-link:hover {
            color: #f3f4f6;
          }
          @keyframes aurora-a {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(6%, -4%) scale(1.1); }
            100% { transform: translate(0, 0) scale(1); }
          }
          @keyframes aurora-b {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-5%, 6%) scale(1.15); }
            100% { transform: translate(0, 0) scale(1); }
          }
          @keyframes aurora-c {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(8%, 3%) scale(1.05); }
            100% { transform: translate(0, 0) scale(1); }
          }
`;


// ─── FAQ accordion ──────────────────────────────────────────────────
