# Frontend Architecture

## Baseline

The frontend is a Next.js App Router application with a mixture of route-owned components, global components, domain services, and a large Zustand store. TypeScript and the production build pass before this refactor.

Largest files at baseline:

| File | Lines | Responsibility |
| --- | ---: | --- |
| `src/components/landing/LandingPage.tsx` | 2948 | Landing layout, sections, animation, content, interaction |
| `src/app/page.tsx` | 2547 | Home route composition and page behavior |
| `src/app/home/page.tsx` | 1941 | Chat UI, conversation state, markdown, navigation, fallback data |
| `src/app/code/page.tsx` | 1386 | Code chat, project generation, files, editor, preview, terminal |
| `src/app/auth/login/page.tsx` | 1235 | Login form, validation, auth requests, visual presentation |
| `src/app/pricing/page.tsx` | 1030 | Pricing content, plan selection, checkout presentation |
| `src/stores/app-store.ts` | 974 | Auth, settings, conversations, messages, UI state, persistence |
| `src/components/settings/settings-modal.tsx` | 651 | Settings navigation, controls, memory, account, legal sections |

## Current Architecture Findings

- Route files contain substantial feature logic and presentation instead of delegating to feature entry points.
- `app-store.ts` owns unrelated auth, chat, settings, memory, workspace, and UI concerns.
- Workspace code imports editor, terminal, preview, and file-explorer behavior through one route-level component.
- Memory has a useful service/store boundary but is mounted through settings without a feature public API.
- The code-generation route combines chat transport, code extraction, file state, preview state, and layout.
- Several legacy utility/store surfaces overlap (`utils/workspace.ts`, `lib/storage.ts`, `lib/store.ts`). The legacy storage modules are excluded from active TypeScript validation and should remain isolated until their consumers are migrated.
- Heavy client-only modules are good candidates for dynamic imports: Monaco editor, terminal, preview, diff viewer, and large workspace tools.
- Shared UI primitives are already present under `src/components/ui`; feature-specific UI should not be added there.

## Target Boundaries

```text
src/
  app/                         thin route entry points
  features/
    auth/                      auth pages, hooks, service adapters
    chat/                      chat UI, conversation hooks, services
    workspace/                 editor, files, terminal, preview, build state
    memory/                    memory UI, store, service, types
    billing/                   plans, checkout, payment UI and services
    settings/                  settings sections and settings hooks
    home/                      home dashboard and landing composition
  components/
    ui/                        reusable visual primitives only
    shared/                    cross-feature layout primitives
  services/                    infrastructure and cross-domain API client
  stores/                      only genuinely cross-feature state
  types/                       shared contracts and API types
  utils/                       focused pure helpers
```

## Refactoring Order

1. Establish feature public entry points and architecture documentation.
2. Isolate workspace state and lazy-load Monaco/terminal/preview surfaces.
3. Isolate memory UI/service/store behind `features/memory` while preserving existing imports through compatibility exports.
4. Split chat transport and conversation behavior from route presentation.
5. Move settings sections out of the monolithic settings modal and keep settings state separate from chat state.
6. Extract auth form logic and auth service adapters.
7. Split home/code/landing route composition only after their behavior has feature-level seams.
8. Migrate legacy storage utilities and remove compatibility paths only after usage is zero.

## Dependency Rules

- `app/` imports feature public APIs, never feature internals.
- Features may import shared UI, infrastructure services, and their own internals.
- Shared UI must not import feature stores or services.
- Services must not import React components.
- Stores may depend on services and domain types, not presentation components.
- Dynamic imports are reserved for heavy client-only modules.

## Known Technical Debt

- `LandingPage.tsx`, `app/page.tsx`, `app/home/page.tsx`, and `app/code/page.tsx` still exceed the preferred size target and require phased extraction.
- `app-store.ts` remains a compatibility-heavy global store until chat/settings/workspace consumers are migrated.
- ESLint has pre-existing React hook and component-shape findings; build and TypeScript are currently green.
- Legacy `lib/storage.ts` and `lib/store.ts` still model a second workspace system and should not be expanded.

## Completed Refactor Slices

- Added public feature entry points for `features/chat`, `features/memory`, and `features/workspace`.
- Moved memory domain types, API service, and Zustand store into `features/memory`; old service/store paths are compatibility facades.
- Moved workspace dashboard presentation and chat transport into `features/workspace`.
- Lazy-loaded Monaco editor, terminal, and preview from the workspace editor surface with loading states.
- Kept all existing routes and API payloads intact.

## Final File-Size Audit

The remaining largest files are intentionally queued for later phases:

| File | Lines | Why it remains | Recommended next split |
| --- | ---: | --- | --- |
| `src/components/landing/LandingPage.tsx` | 2948 | Multi-section marketing composition with substantial visual content | Extract hero, feature sections, testimonials, CTA, and animation primitives |
| `src/app/page.tsx` | 2547 | Root landing route still owns page composition and interactions | Move landing page to `features/home` and leave a thin route wrapper |
| `src/app/home/page.tsx` | 1941 | Chat shell, conversation navigation, markdown, and fallback behavior remain coupled | Extract chat shell, message list, composer, conversation sidebar, and home data hook |
| `src/app/code/page.tsx` | 1386 | Code-generation workflow combines chat, file mapping, preview, and build actions | Extract code-generation hook, file session hook, and split view components |
| `src/app/auth/login/page.tsx` | 1235 | Visual login page still contains form and auth flow | Extract auth form hook/service and presentation sections |
| `src/app/pricing/page.tsx` | 1030 | Pricing presentation and checkout selection remain route-owned | Extract plan data, plan cards, and checkout action hook |
| `src/stores/app-store.ts` | 974 | Compatibility store still combines global concerns | Migrate chat/settings/workspace consumers into feature stores, then remove slices |
| `src/components/settings/settings-modal.tsx` | 651 | Many settings sections remain in one modal | Extract section components and settings field definitions |

## Validation

- `npm run typecheck`: passing
- `npm run build`: passing; all 30 routes generated
- `npm run lint`: still failing on pre-existing React hook, display-name, and render-purity findings across legacy files; no lint rule was disabled.

## Scalability Note

This refactor improves ownership, testability, incremental builds, and client bundle boundaries. It does not by itself make the system capable of serving massive traffic; that requires horizontally scalable backend APIs, distributed data/storage, caching, observability, and deployment architecture.
