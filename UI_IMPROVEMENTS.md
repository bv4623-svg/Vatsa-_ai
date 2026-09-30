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

## Phase 3, page 1: `/home`

**Measured:** contrast is taken from the screenshots themselves (text pixels against background pixels, WCAG formula), because CSS alone can't account for what shows through translucent layers. Light and dark, desktop and phone. WCAG AA needs 4.5:1 for text and 3:1 for icons.

| Measure | Light: before → after | Dark: before → after |
|---|---|---|
| AI reply text | **3.22** → 17.85 | 14.56 → 17.06 |
| "Vatsa AI · time" label | **1.04** → 4.76 | **3.38** → 6.96 |
| Action icons (read aloud, copy, regenerate, 👍/👎, share) | **1.04** → 4.76 | 3.35 → 6.96 |
| "What would you like to build today?" / suggestion chips | **1.09 / 2.56** → 4.76 | 7.40 → 6.96 |
| Disclaimer (empty state) | **1.05** → 4.76 | **3.38** → 6.96 |
| Chat/Code toggle | **1.49** → 16.3 | 7.54 → 13.98 |
| Plan badge | (not measured before) → 7.07 | → 10.03 |
| Particle animation running | yes → **no** | yes → **no** |
| Markdown lists | no bullets, 0 px indent → disc/decimal, 20 px | same |
| Code block | no box, **copy button over the code** → box, 36 px top room (52 px on touch), no overlap | same |
| First action icon vs text edge | 4 px desktop / 14 px phone → 0 | same |

**Changes:**
- **Plain background:** `<Background />` is gone from `/home` (the landing page keeps it). The header, chat area and chat box are solid `bg-background` / `bg-card`, not 40–80% translucent with blur.
- **`.chat-markdown`** (`globals.css`, replacing the dead `prose` classes on replies):
  - lists with bullets and numbers, paragraph spacing, heading sizes, a quote bar;
  - inline code on a subtle background;
  - code blocks in a rounded box. Long lines scroll inside it, and the copy button is pinned to the box's corner.
- **Readable muted text:** `text-muted-foreground/60` → `text-muted-foreground` for the reply label, action icons, user timestamp, typing cursor and both disclaimers. The user bubble uses the `bg-muted` token instead of hard-coded `bg-zinc-100` / `dark:bg-[#1B1B1B]`.
- **Alignment:** the action row is shifted by its button padding (`-ml-1`, `-ml-3.5` on touch), so the first icon lines up with the text.
- **Header:**
  - the Chat/Code toggle uses theme colours (it had a dark-only `bg-black/20` / `text-white` look);
  - "Chat" is marked active on `/home` (it checked `/`, so on this page neither tab ever looked active) and links there directly instead of through `/`;
  - plan badges use `-700` (light) and `-300` (dark) text;
  - the "Upgrade to Pro" gradient is `-600` so its white text passes.
- **Copy button** (`CodeCopyButton`): theme colours (it had white-on-black, made for dark code boxes only).

**Found once the background was plain.** The animated canvas had hidden these from axe, which marked contrast over it as "can't tell". Axe then flagged:
- the six tool labels in the empty-state box (`text-muted-foreground` on the `accent/5` tint, about 4.45:1) → `text-foreground/75`. Their active state (`text-accent` on `accent/20`) → `text-purple-700` / `dark:text-purple-300`;
- the "sources" toggle and source domains (`SourcesList`), reasoning text (`ThinkingBox`) and the image-loading note (`ImageLoadingGrid`) were faded to 70% → full `text-muted-foreground`;
- citation links `[1]` in replies: purple on white was about 3.9:1 (and failed in dark too) → `text-purple-700` / `dark:text-purple-300`, **underlined**, because axe's `link-in-text-block` rule requires links to differ by more than colour.
After these, axe passes on every screen in both themes (22/22).

**Found for later:**
- `/code` and `/workspace` also render the landing's animated background.
- 9 more files use the dead `prose` classes: `CodeChatPanel`, `workspace`, and the about and legal pages.
- `components/home/HomeBackground.tsx` is an unused stub (Phase 5).

## Phase 3, page 2: `/pricing`

**Measured:** same method as `/home`. Contrast comes from screenshots, light and dark, desktop and phone. Where the old animated background made "most common colour" unreliable, the text's CSS colour is compared with the median background colour behind it. The "5x" badge has a gradient behind it, so each pixel column's background is read from the badge's padding rows, and the lowest value is reported.

**Cause:** the page drew an always-dark animated background (`components/pricing/Background.tsx`: particle canvas, three 130–150 px blurred blobs) under a header, text and cards that follow the theme. In light mode that put near-black text on a near-black page.

**Owner decision applied:** plain background, the same choice as `/home`.

| Measure | Light: before → after | Dark: before → after |
|---|---|---|
| Heading "Choose the plan that fits" | **1.08** → 17.75 | 17.43 → 16.22 |
| Subtitle | **2.57** → 7.56 | 7.49 → 6.86 |
| "Last Updated" date | 7.49 → 4.84 | **4.03** → 6.86 |
| Header nav "Home" / "App" (were blue) | **2.37** → 7.56 | 5.41 → 6.86 |
| Breadcrumb "Home" (was blue) | 5.19 → 7.56 | 5.21 → 6.86 |
| "⚡ 5x more power than Pro" badge (lowest point of its gradient) | **1.88** → 5.02 | **1.88** → 5.02 |
| ✓ / ✗ feature icons (need 3:1) | **2.22 / 2.89** → 3.22 / 3.81 | 9.08 / 6.97 (same) |
| Gradient word "you" / "Questions" (large text, needs 3:1; computed from the colours) | 5.17–5.70 (same) | 3.13–3.74 → 6.56–7.02 |
| "Most Popular" badge | 5.17 (same) | 5.17 (same) |
| Buttons: Free / Pro / Business | 10.31 / 5.17 / 10.31 (same) | 13.66 / 5.17 / 13.66 (same) |

| Measure | Before | After |
|---|---|---|
| Headers on the page | 1 (light header over a dark page) | 1 (matches the page in both themes) |
| "5x" badge | 2 lines on desktop | 1 line (desktop and phone) |
| Font sizes on the page | desktop 10 (10, 12, 14, 16, 17, 18, 20, 30, 36, 48), phone 9 | 4 (12, 14, 20, 36), plus the 17 px "vatsa.ai" logo wordmark |
| Heading size, desktop | 48 px | 36 px (same as phone) |
| Header nav link height | 20 px | 28 px |
| Phone menu links | blue, 20 px tall, no current page | theme grey, current page marked (`aria-current`), 40 px tall |
| Touch targets under 24 px | desktop 13, phone 1 | desktop 10 (footer links and breadcrumb, at least 24 px apart), phone 0 |
| Animations running | 5, plus the particle canvas | 2 (the gradient-word shimmer), no canvas |
| Rupee prices | ₹2,300 / ₹9,500 from the live rate (1 call) | same |
| Sideways overflow / console errors | 0 / 0 | 0 / 0 |

**Changes:**
- **Background:** `<Background />` is gone from `/pricing`, and the page uses `bg-background`.
- **Header** (`PageHeader`, shared with the legal pages):
  - nav links set their own grey. The global `a { color: primary-500 }` rule had turned every inactive link blue;
  - links are 28 px tall;
  - the phone menu uses the same colours, marks the current page, and has 40 px rows;
  - the header background is `bg-background/80`, so it matches the page in dark mode;
  - the plan pill is 12 px, not 11.
- **Font sizes:** four sizes are used — 12 (badges, notes, logo names), 14 (body, nav, FAQ), 20 (the subtitle and every h2) and 36 (the heading and prices).
  - Heading 48 → 36 px.
  - Subtitle 18 → 20 px.
  - FAQ title 30 → 20 px.
  - FAQ questions and "/ month" 16 → 14 px.
  - Logo names 10 → 12 px.
- **Badges:** both badges stay on one line (`whitespace-nowrap`). The "5x" gradient is amber-700 → purple-600, not amber-400 → purple-500.
- **Muted text:**
  - "Last Updated" uses gray-500 (light) / gray-400 (dark), not gray-400 / gray-500;
  - the breadcrumb link is grey, not the global blue, and is 44 px on touch screens;
  - ✓ icons are green-600 (light), ✗ icons red-500 (light), and the trust shields green-600.
- **Dark mode gradient text:** lighter stops (blue-400 → violet-400) in dark mode.
- **Model logos:** five logos are white artwork (OpenAI, Grok, Midjourney, Ollama, Anthropic) and vanished on the light page. They are inverted in light mode only. The footer's OpenAI and Grok logos get the same fix.

**Found for later:**
- **Legal and info pages** (`/privacy`, `/terms`, `/refund`, `/return`, `/disclaimer`, `/about`, `/contact`, `/security`) draw the same always-dark background under theme-following text, so they likely have the same light-mode problem (same code pattern; not measured yet). Until they change, the footer's OpenAI and Grok logos are dark on their dark background in light mode.
- `components/pricing/Background.tsx` and `Particles.tsx` are now unused (Phase 5).
- **Plan buttons:** they are only as wide as their label, because the `Magnetic` wrapper is `inline-block`. They also don't line up across cards: Pro and Business have a note under the button and Free doesn't.
- **Free card:** shows "Free" twice (plan name and price).
- **Poe and Perplexity logos:** faint in light mode (light artwork after the grayscale filter).
- **e2e test:** "with 2FA on, the code is asked for…" (`e2e/signup.spec.ts`) failed twice under memory pressure, because the code was typed and then cleared (the input was wiped before the page finished loading). It passes 6/6 on its own.
