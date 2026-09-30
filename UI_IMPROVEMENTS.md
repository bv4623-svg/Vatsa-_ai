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
