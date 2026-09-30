# UI_IMPROVEMENTS.md

A running record of the UI/UX clean-up: what was measured, what changed, and the proof. Branch `feat/ui-polish`, which builds on `feat/phase-0-fixes`.

**Rules for this work:** no new libraries, no new features, no backend changes, one commit per page or category, and every test suite stays green.

## How it's measured

A temporary Playwright script measures pages from the production build with the mocked backend, the same setup as the e2e tests.
- **Where it lives:** kept outside the repo and copied into `e2e/` only for a run, so the e2e suite never picks it up.
- **Sizes:** desktop 1440×900, and the phone project (Pixel 7, 412 × 839 visible).
- **What it records:** computed sizes, padding, font sizes, sideways overflow, console errors, touch targets under 24 and 44 px, layout shift (CLS), and a screenshot.

Before and after numbers always come from the same script.

## Phase 1: audit (2026-09-30, light mode)

**Existing design system:** Tailwind v4 `@theme` in `src/app/globals.css`.
- Colour tokens for light and dark (`--background`, `--card`, `--border`, `--muted-foreground`, `--accent`, …).
- Corner radii of 2, 6, 8 and 12 px, and the Inter and JetBrains Mono fonts.
- Spacing and font sizes use Tailwind's standard scale.

The plan is to follow it, not add a second system.

| Page | Priority | Problems found |
|---|---|---|
| `/home` | High | Grey veil: the landing page's dark animated background (`components/landing/Background.tsx`, a particle canvas plus 130–150 px blurs) shows through a 40%-opaque chat panel. Empty-state box 760 × 230 px with 20 px text. Phone text field 16 px wide (8 buttons in one row). Replies: lists have no bullets and code blocks no box, because the Tailwind typography plugin behind the `prose` classes isn't installed. Faint "Vatsa AI · time" labels and action icons. |
| `/pricing` | High | The dark heading on a dark background is nearly invisible (axe can't judge contrast over a background image). A light header over a dark page. Mixed nav-link colours. The "5x more power" badge wraps. 10 different font sizes. |
| `/login`, `/signup` | Medium | Two different looks (dark split screen vs zinc card), and hard-coded colours. PR #7 (CAPTCHA) changes these pages too. |
| `/wall` | Medium | Headings in reverse order (page title 14 px, sections 12 px). Empty grid space. Rating-filter bars under 24 px on phones. Layout shift 0.067 on phones. |
| Settings | Medium | Two settings screens (the dialog, and a `/settings` page with only Memory and Language). The `/settings` page fails completely if one API response has an unexpected shape. |
| Sidebar | Low | Settings appears twice (gear icon and link). |

No sideways overflow on any audited page. Console errors only from the mock (`/settings`, where `{}` stood in for a list).

**Owner decisions:**
- **Phone chat box:** two rows.
- **Chat background:** plain (fixed in Phase 3).
- **Phase 2:** as planned.

## Phase 2: chat box (`/home`)

| Measure | Before | After |
|---|---|---|
| Empty-state box, desktop | 760 × 230 px | 760 × 126 px |
| Empty-state box, phone | 380 × 320 px | 380 × 134 px |
| Empty-state text field | 120 px tall, 20 px text, grows to 300 px | 1 line (40 px), 15 px, grows to 4 lines (112 px) |
| Empty-state box padding / send button | 16 px / 44 px | 12 px / 36 px |
| Chat text field, phone | **16 px wide** | 362 px (own row; buttons on a second row) |
| Chat text field growth | up to 200 px (~9 lines) | up to 112 px (4 lines), then scrolls |
| Chat text size | 14/20 px | 15/24 px |
| Chat box to screen bottom | 36 px | 28 px |
| User bubble | padding 10/16, 14 px | padding 8/12, 15 px |
| AI reply text | 16/26 px | 15/28 px (same size as the user's) |
| Space between messages | 24 px (a question's text to its reply's text: 44 px, including the "Vatsa AI" label line) | 16 px (36 px including the label) |
| Touch targets under 24 px on `/home` | 1 (the phone text field) | 0 |

Also in this commit:
- **Phone empty state:** the six tool buttons are icon-only on phones, as the docked chat box already was. Their names stay as accessible labels and tooltips, so nothing is removed.
- **Feedback button:** the floating button sits above the docked chat box whatever its height (it publishes `--chat-dock-h`), and stays at its old 112 px when there's no docked box.

Files: `src/lib/home/constants.ts` (`COMPOSER_MAX_HEIGHT_PX`), `src/app/home/page.tsx`, `src/components/home/ChatEmptyState.tsx`, `src/components/home/ChatMessagesView.tsx`, `src/components/home/ComposerExtras.tsx`, `src/components/feedback/FeedbackButton.tsx`.
