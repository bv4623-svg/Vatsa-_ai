\# Vatsa AI — Full Codebase Repair, Refactor \& Product Architecture PRD



\## 1. PROJECT CONTEXT



You are working on an existing full-stack AI coding/productivity application called \*\*Vatsa AI\*\*.



The project is located at:



```text

D:\\vatsa ai\\Backend

D:\\vatsa ai\\frontend

```



This is an EXISTING application.



Your job is NOT to rebuild the application from scratch.



Your job is to:



1\. Audit the complete existing codebase.

2\. Understand the current architecture and existing features.

3\. Fix broken functionality.

4\. Refactor oversized files into small, maintainable modules.

5\. Add the missing backend/frontend architecture required for a production-ready application.

6\. Preserve the existing UI, routes, functionality, and design wherever possible.

7\. Avoid unnecessary rewrites.

8\. Never remove a working feature simply because it is inconvenient to maintain.



The final result should be a clean, modular, scalable Vatsa AI codebase.



\---



\# 2. MOST IMPORTANT RULE



\## DO NOT DESTROY EXISTING FUNCTIONALITY



Before modifying anything:



\* Inspect the entire repository.

\* Understand the current frontend architecture.

\* Understand the current backend architecture.

\* Identify existing routes.

\* Identify authentication flow.

\* Identify database models.

\* Identify API endpoints.

\* Identify AI/model integration.

\* Identify project/code generation flow.

\* Identify chat flow.

\* Identify existing memory/history implementation.

\* Identify payment implementation, if any.

\* Identify token/usage implementation, if any.

\* Identify environment variables.

\* Identify dependencies.



Do not blindly replace existing files.



If a feature already works, preserve it.



If a feature is partially implemented, repair it.



If architecture is poor, refactor it carefully.



\---



\# 3. PRIMARY OBJECTIVES



The following are the main objectives.



\### Priority 1 — Fix Code Page



The Code page is currently not functioning correctly.



The Code page must become fully functional.



It should be capable of:



\* accepting user prompts,

\* sending prompts to the backend,

\* receiving AI responses,

\* displaying AI responses,

\* generating/editing code,

\* displaying generated code,

\* maintaining conversation context,

\* maintaining project context,

\* showing appropriate loading states,

\* showing errors,

\* preserving generated content,

\* allowing the user to continue the conversation,

\* keeping project/code state consistent,

\* supporting download/export where the existing product intends to provide it.



Do not create a fake/static Code page.



It must be connected to the real backend and real AI system.



\---



\# 4. AUTHENTICATION / LOGIN SYSTEM



The existing login system is currently not functioning correctly.



Repair the complete authentication flow.



The system should support, depending on what is already implemented:



\* registration,

\* login,

\* logout,

\* authentication persistence,

\* protected routes,

\* current-user retrieval,

\* session/token persistence,

\* frontend auth state,

\* backend authentication validation.



After a successful login:



```text

Frontend

&#x20;  ↓

Authentication API

&#x20;  ↓

Backend validates credentials

&#x20;  ↓

User/session/token created

&#x20;  ↓

Frontend stores authentication state

&#x20;  ↓

Application loads current user

&#x20;  ↓

User-specific data becomes available

```



The application must know which authenticated user is currently using it.



\---



\# 5. REAL USER IDENTITY



A major requirement is that the AI must know the currently authenticated user.



For example, if the user logs in with their name:



```text

Bighnesh

```



and later asks:



> Who am I?



The AI/application should be able to use the authenticated user's stored profile information where appropriate.



This must NOT be implemented by hardcoding a name.



It must come from the authenticated user record.



The architecture should support:



```text

User

&#x20;├── id

&#x20;├── name

&#x20;├── email

&#x20;├── created\_at

&#x20;├── updated\_at

&#x20;└── account/subscription information

```



The frontend should obtain the current user through a proper authenticated endpoint/state.



\---



\# 6. USER DATA ISOLATION



This is extremely important.



Every user's data must remain private to that user.



User A must NEVER receive:



\* User B's conversations

\* User B's memory

\* User B's projects

\* User B's generated code

\* User B's token balance

\* User B's payment information

\* User B's usage history



Every user-owned database entity must have a clear relationship to the authenticated user.



Example:



```text

User

&#x20;├── Conversations

&#x20;├── Messages

&#x20;├── Memories

&#x20;├── Projects

&#x20;├── Generated files

&#x20;├── Token balance

&#x20;├── Usage records

&#x20;└── Payment/subscription records

```



Every backend endpoint must verify ownership.



Never trust a `user\_id` supplied directly by the frontend.



The backend must derive the authenticated user from the authentication/session mechanism.



\---



\# 7. SHARED USER MEMORY BETWEEN CHAT AND CODE



Vatsa AI has two major experiences:



```text

Normal Chat

Code / AI Builder

```



The same authenticated user's relevant memory/context should be available across both.



For example:



```text

User logs in

&#x20;      ↓

User tells Chat:

"My preferred programming language is TypeScript."

&#x20;      ↓

Memory is stored for that user

&#x20;      ↓

User opens Code page

&#x20;      ↓

Code AI can access relevant user memory

```



The memory must be user-specific.



It must NOT be global.



Required architecture:



```text

User

&#x20; ↓

User Memory

&#x20; ↓

&#x20;├── Chat

&#x20;└── Code

```



The Chat page and Code page should NOT maintain two unrelated memory systems.



Create a centralized memory service/repository where appropriate.



\---



\# 8. CONVERSATION HISTORY



Implement/fix proper user-specific history.



The user should be able to see their own previous:



\* chat conversations,

\* code conversations,

\* projects,

\* generated work.



History must be persisted in the backend/database.



Avoid storing important persistent history only in React state or browser memory.



Suggested conceptual structure:



```text

User

&#x20; ↓

Conversation

&#x20; ├── id

&#x20; ├── user\_id

&#x20; ├── type

&#x20; ├── title

&#x20; ├── created\_at

&#x20; └── updated\_at



Conversation

&#x20; ↓

Messages

&#x20; ├── role

&#x20; ├── content

&#x20; ├── metadata

&#x20; └── created\_at

```



Conversation type can distinguish:



```text

chat

code

```



The exact implementation should follow the existing database architecture where possible.



\---



\# 9. PROJECT / CODE WORKSPACE



The Code experience should have proper project context.



A project may contain:



```text

Project

&#x20;├── owner/user

&#x20;├── name

&#x20;├── description

&#x20;├── files

&#x20;├── conversation

&#x20;├── generated code

&#x20;├── created\_at

&#x20;└── updated\_at

```



The AI should understand which project the user is currently working on.



When a user continues working on a project, the backend should retrieve the relevant project context instead of treating every prompt as a completely new request.



\---



\# 10. AI REQUEST ARCHITECTURE



Do not put all AI logic directly inside giant route/controller files.



Create a proper service layer.



Conceptually:



```text

API Route

&#x20;  ↓

Authentication

&#x20;  ↓

Usage/Token Check

&#x20;  ↓

Conversation Service

&#x20;  ↓

Memory Service

&#x20;  ↓

Project Context Service

&#x20;  ↓

AI Service

&#x20;  ↓

Model Provider

&#x20;  ↓

Response Processing

&#x20;  ↓

Usage Recording

&#x20;  ↓

Frontend

```



The AI provider should be abstracted.



For example:



```text

AIService

&#x20;├── Gemini provider

&#x20;├── OpenRouter provider

&#x20;└── Future providers

```



Do not tightly couple the entire application to one model provider.



\---



\# 11. TOKEN / CREDIT SYSTEM



Create a proper token/credit system.



The system should support the concept:



```text

Money paid

&#x20;     ↓

Payment verified

&#x20;     ↓

Tokens/credits added

&#x20;     ↓

User uses AI

&#x20;     ↓

Tokens deducted

```



Do NOT simply add tokens because the frontend says that payment was successful.



The backend must verify the payment before granting paid credits.



\---



\# 12. TOKEN ACCOUNT



Each user should have a token/credit account.



Conceptually:



```text

User

&#x20;↓

TokenAccount

&#x20;├── balance

&#x20;├── total\_purchased

&#x20;├── total\_used

&#x20;└── updated\_at

```



Usage should be recorded separately where useful:



```text

TokenTransaction

&#x20;├── id

&#x20;├── user\_id

&#x20;├── type

&#x20;├── amount

&#x20;├── reason

&#x20;├── reference\_id

&#x20;└── created\_at

```



Possible transaction types:



```text

purchase

usage

refund

bonus

adjustment

```



\---



\# 13. TOKEN LIMITS



AI requests must check token availability before calling expensive models.



Flow:



```text

User sends AI request

&#x20;       ↓

Authenticate user

&#x20;       ↓

Check account

&#x20;       ↓

Calculate/estimate required usage

&#x20;       ↓

Check available tokens

&#x20;       ↓

If insufficient → reject gracefully

&#x20;       ↓

If sufficient → execute AI request

&#x20;       ↓

Calculate actual usage

&#x20;       ↓

Deduct tokens

&#x20;       ↓

Save usage transaction

&#x20;       ↓

Return response

```



Never allow users to bypass token limits by calling the AI endpoint directly.



Token validation must happen on the backend.



\---



\# 14. FREE VS PAID USAGE



Create a flexible usage system supporting:



```text

Free user

Paid user

Premium user

```



The exact pricing should remain configurable rather than hardcoded throughout the application.



Create a centralized configuration/service for plans and limits.



Example conceptual structure:



```text

Plan

&#x20;├── name

&#x20;├── monthly\_tokens

&#x20;├── daily\_requests

&#x20;├── max\_context

&#x20;├── available\_models

&#x20;└── features

```



Do not scatter limits across 20 frontend files.



\---



\# 15. PAYMENT PAGE



Integrate a proper payment page into the existing application.



The payment system should eventually support:



```text

User

&#x20;↓

Select plan/package

&#x20;↓

Payment page

&#x20;↓

Payment provider

&#x20;↓

Payment completed

&#x20;↓

Backend verifies payment

&#x20;↓

Payment marked successful

&#x20;↓

Tokens credited

&#x20;↓

User gets paid features

```



IMPORTANT:



Frontend payment success is NOT enough.



Never do:



```text

if frontend says paymentSuccess:

&#x20;   add tokens

```



Instead:



```text

Payment provider

&#x20;     ↓

Backend verification/webhook

&#x20;     ↓

Verify amount/order/payment/signature

&#x20;     ↓

Mark payment verified

&#x20;     ↓

Credit tokens

```



The payment architecture should be provider-agnostic where practical so another payment provider can be integrated later.



\---



\# 16. PAYMENT SECURITY



Never trust:



\* frontend price,

\* frontend token amount,

\* frontend payment status,

\* frontend user ID.



The backend should determine:



```text

user

plan

amount

tokens

payment status

```



from trusted server-side data.



Prevent duplicate token credits.



A payment/order should not be able to credit tokens multiple times.



Use an idempotent payment-processing mechanism.



\---



\# 17. PREMIUM MODEL ACCESS



After a verified payment/plan upgrade:



```text

User

&#x20;↓

Verified subscription/payment

&#x20;↓

Premium entitlement

&#x20;↓

Premium model becomes available

```



Without verification, premium models must remain inaccessible.



Model access should be checked server-side.



The frontend may hide premium models for UX, but the backend must enforce access.



\---



\# 18. HUGE FILE REFACTORING



This is one of the biggest requirements.



The current project contains very large files, including files with thousands/tens of thousands of lines.



Do NOT leave giant files simply because they currently work.



Break them into logical modules.



For example, instead of:



```text

page.tsx

&#x20; 20,000+ lines

```



create something conceptually like:



```text

page.tsx



components/

&#x20;├── ChatPanel.tsx

&#x20;├── CodeEditor.tsx

&#x20;├── PreviewPanel.tsx

&#x20;├── Sidebar.tsx

&#x20;├── Header.tsx

&#x20;├── MessageList.tsx

&#x20;├── MessageInput.tsx

&#x20;├── ProjectFiles.tsx

&#x20;└── ...



hooks/

&#x20;├── useChat.ts

&#x20;├── useProject.ts

&#x20;├── useAuth.ts

&#x20;├── useMemory.ts

&#x20;└── useTokens.ts



services/

&#x20;├── api.ts

&#x20;├── chatService.ts

&#x20;├── projectService.ts

&#x20;├── authService.ts

&#x20;└── aiService.ts



utils/

&#x20;├── formatting.ts

&#x20;├── validation.ts

&#x20;└── helpers.ts



types/

&#x20;├── auth.ts

&#x20;├── chat.ts

&#x20;├── project.ts

&#x20;└── ai.ts

```



This is an example.



DO NOT blindly create these exact files.



First inspect the existing architecture and create the structure that actually fits the application.



\---



\# 19. FILE SIZE PRINCIPLE



Avoid huge files.



Target:



```text

\~50–150 lines

```



for simple components/modules where practical.



Some files may naturally be:



```text

150–300 lines

```



That is acceptable if the responsibility is cohesive.



Avoid:



```text

1000+

2000+

5000+

10000+

```



line files whenever the code can logically be separated.



Do NOT artificially split code into useless one-function files.



The goal is:



```text

small

simple

logical

maintainable

testable

reusable

```



\---



\# 20. FRONTEND ARCHITECTURE



Create a clean frontend architecture appropriate for the existing Next.js application.



Conceptually:



```text

frontend/

├── src/

│   ├── app/

│   ├── components/

│   ├── features/

│   │   ├── auth/

│   │   ├── chat/

│   │   ├── code/

│   │   ├── projects/

│   │   ├── memory/

│   │   ├── billing/

│   │   └── tokens/

│   ├── hooks/

│   ├── services/

│   ├── lib/

│   ├── types/

│   ├── utils/

│   └── constants/

```



Again, inspect the existing structure before implementing.



Do not move everything unnecessarily if the current structure already follows a good architecture.



\---



\# 21. BACKEND ARCHITECTURE



Refactor the backend into clear responsibilities.



Conceptually:



```text

Backend/

├── routes/

├── controllers/

├── services/

├── repositories/

├── models/

├── schemas/

├── middleware/

├── auth/

├── ai/

├── memory/

├── chat/

├── projects/

├── billing/

├── tokens/

├── database/

├── utils/

└── config/

```



Use the existing backend framework and database architecture.



Do not migrate technologies unnecessarily.



\---



\# 22. DATABASE



Inspect the existing database before changing schemas.



If the existing database already contains useful models, migrate/refactor them instead of deleting them.



The database should be able to represent at minimum:



```text

users

conversations

messages

memories

projects

project\_files

token\_accounts

token\_transactions

payments

subscriptions/entitlements

usage\_records

```



Not every table must be created if an equivalent structure already exists.



Avoid duplicate models representing the same concept.



\---



\# 23. DATABASE MIGRATIONS



Any schema change must be handled safely.



Do not simply delete the database.



Do not destroy existing user data.



Create proper migrations where the existing backend/database system supports migrations.



If migration logic already exists, use it.



Before destructive database operations:



1\. Backup the database.

2\. Inspect existing records.

3\. Migrate data.

4\. Verify the migrated structure.



\---



\# 24. AUTHENTICATED API DESIGN



Every user-owned API endpoint should follow this pattern:



```text

Request

&#x20;↓

Authentication middleware

&#x20;↓

Get authenticated user

&#x20;↓

Validate request

&#x20;↓

Check ownership

&#x20;↓

Perform operation

&#x20;↓

Return response

```



Never rely on:



```text

request.body.user\_id

```



as the authority for ownership.



\---



\# 25. ERROR HANDLING



Create consistent error handling.



The application should not randomly crash or return confusing errors.



Backend errors should have predictable structures.



Frontend should display useful user-facing errors.



Handle:



\* authentication errors,

\* expired sessions,

\* invalid requests,

\* AI provider errors,

\* payment failures,

\* insufficient tokens,

\* database errors,

\* network errors,

\* rate limits,

\* model unavailable errors.



Do not expose secrets, stack traces, API keys, or internal database information to users.



\---



\# 26. LOADING STATES



Every important async operation should have proper loading states.



Examples:



```text

Logging in...

Loading conversation...

Generating...

Saving...

Processing payment...

Checking payment...

Loading project...

```



Avoid UI freezing or appearing broken while an API request is running.



\---



\# 27. API CLIENT



Do not duplicate raw `fetch()` logic throughout dozens of components.



Create a centralized API client where appropriate.



It should handle:



\* base URL,

\* authentication headers/cookies,

\* JSON handling,

\* common errors,

\* response parsing,

\* possibly retries where appropriate.



Then services can use it.



Example:



```text

apiClient

&#x20;  ↓

authService

chatService

projectService

memoryService

billingService

tokenService

```



\---



\# 28. STATE MANAGEMENT



Inspect the current state management system.



Do not introduce Redux/Zustand/etc. just for the sake of it if the current architecture does not need it.



However, avoid duplicating important global state across components.



At minimum, the application should have a reliable source of truth for:



```text

currentUser

authentication

conversation

project

tokens/usage

subscription/entitlements

```



\---



\# 29. CODE PAGE UX



Preserve the current Vatsa AI design.



Do NOT redesign the entire application.



The Code page should provide a coherent workflow:



```text

User

&#x20;↓

Prompt

&#x20;↓

AI

&#x20;↓

Generated code

&#x20;↓

Preview/editor

&#x20;↓

Continue conversation

&#x20;↓

Modify code

&#x20;↓

Save project

&#x20;↓

Download/export

```



The existing intended layout should remain unless fixing it requires structural changes.



\---



\# 30. CHAT PAGE



The normal Chat page should:



\* work independently,

\* use the authenticated user,

\* store conversations,

\* retrieve history,

\* use user memory,

\* use token accounting,

\* respect model entitlements,

\* handle errors,

\* persist messages.



It should share backend services with Code where appropriate rather than duplicating logic.



\---



\# 31. CHAT + CODE MEMORY MODEL



Do not create:



```text

ChatMemory

CodeMemory

```



as completely separate unrelated systems.



Prefer:



```text

UserMemory

&#x20;  ↓

&#x20;├── Chat

&#x20;└── Code

```



Context can be filtered depending on the current task.



For example, Code AI may prioritize:



\* programming preferences,

\* current project information,

\* technical context.



Normal Chat may prioritize broader user preferences.



\---



\# 32. SECURITY



Perform a complete security review.



Check:



\* authentication,

\* authorization,

\* password handling,

\* session handling,

\* JWT/cookie handling,

\* CORS,

\* environment variables,

\* API keys,

\* SQL injection,

\* unsafe database queries,

\* XSS,

\* CSRF where applicable,

\* file upload handling,

\* payment verification,

\* rate limiting,

\* user ownership checks.



Never expose:



```text

API keys

database credentials

payment secrets

JWT secrets

provider secrets

```



to the frontend.



\---



\# 33. ENVIRONMENT VARIABLES



Audit `.env`, `.env.local`, backend environment configuration, etc.



Separate:



```text

PUBLIC frontend configuration

```



from:



```text

PRIVATE server secrets

```



Never move secret API keys into frontend-exposed variables.



Document required environment variables without exposing actual secret values.



\---



\# 34. API / SERVICE SEPARATION



Do not put business logic directly into UI components.



Bad:



```text

React Component

&#x20;├── authentication

&#x20;├── database logic

&#x20;├── AI logic

&#x20;├── payment logic

&#x20;├── token calculation

&#x20;└── UI

```



Preferred:



```text

UI

&#x20;↓

Hook

&#x20;↓

Service

&#x20;↓

API

&#x20;↓

Backend

&#x20;↓

Business Service

&#x20;↓

Database/AI Provider

```



\---



\# 35. LOGGING



Add useful structured logging where necessary.



Logs should help debug:



```text

authentication

AI requests

payment verification

token transactions

database errors

```



Do not log:



\* passwords,

\* API keys,

\* payment secrets,

\* sensitive personal data.



\---



\# 36. TESTING



After refactoring, do not assume that the application works.



Test the important flows.



\### Authentication



```text

Register

Login

Refresh/reload

Current user

Logout

Protected page

```



\### Chat



```text

Open chat

Send message

Receive AI response

Save message

Reload

History appears

```



\### Code



```text

Open Code page

Send prompt

AI responds

Code appears

Continue prompt

Project persists

Reload

Project remains

```



\### Memory



```text

Tell AI a persistent preference

Save memory

Open another page

Ask relevant question

Memory available

```



\### Tokens



```text

User has tokens

AI request succeeds

Usage recorded

Tokens decrease

Insufficient tokens rejected

```



\### Payment



```text

Create payment

Complete payment

Verify server-side

Credit tokens

Prevent duplicate credit

Enable premium entitlement

```



\---



\# 37. BUILD / TYPE / LINT



After changes:



Run the appropriate checks for the existing project.



At minimum:



```text

Frontend:

\- typecheck

\- lint

\- build



Backend:

\- syntax/import validation

\- tests if available

\- startup validation

```



Fix errors instead of ignoring them.



Do not finish with known compile errors.



\---



\# 38. DO NOT USE FAKE IMPLEMENTATIONS



Never solve a missing feature using fake data.



Do not do things like:



```text

currentUser = {

&#x20;   name: "Bighnesh"

}

```



Do not create fake payment success.



Do not create fake token balances.



Do not create fake memory.



Do not hardcode AI responses.



Do not create dummy history just to make the UI look functional.



Everything important must connect to the real backend/database/services.



\---



\# 39. PRESERVE EXISTING DATA



If the existing application already has:



\* users,

\* projects,

\* conversations,

\* messages,

\* database records,



do not delete them during refactoring.



Back up the database first.



If models are being renamed or merged, migrate the existing records.



\---



\# 40. REFACTORING STRATEGY



Do NOT attempt a reckless "rewrite everything" operation.



Use this order:



\### Phase 1 — Audit



Inspect:



```text

Backend

frontend

database

routes

components

services

models

environment configuration

```



Create an internal architecture map.



\### Phase 2 — Stabilize



Fix:



```text

login

authentication

current user

API connectivity

Code page

basic Chat flow

```



\### Phase 3 — Data Architecture



Fix:



```text

user ownership

conversation

messages

memory

projects

history

```



\### Phase 4 — Token System



Implement:



```text

token account

usage tracking

limits

transactions

```



\### Phase 5 — Payment



Implement:



```text

payment page

order/payment creation

server verification

webhook if required

idempotency

token crediting

premium entitlement

```



\### Phase 6 — Refactoring



Split:



```text

huge frontend files

huge backend files

large components

large services

large route files

```



\### Phase 7 — Validation



Test:



```text

auth

chat

code

memory

history

projects

tokens

payments

premium access

```



\### Phase 8 — Cleanup



Remove:



\* dead code,

\* duplicate services,

\* unused imports,

\* obsolete components,

\* temporary debugging code,

\* duplicate API logic.



Do NOT remove anything unless you have confirmed it is unused.



\---



\# 41. IMPORTANT: DO NOT CHANGE THE UI UNNECESSARILY



The current Vatsa AI UI is important.



Unless required to fix a broken feature:



DO NOT:



\* redesign the application,

\* change colors,

\* change layout,

\* change routes,

\* replace working components,

\* change navigation,

\* remove existing functionality.



Refactoring should be primarily architectural.



The user should feel that it is the same Vatsa AI, but technically much cleaner and more reliable.



\---



\# 42. CODE QUALITY STANDARD



Every newly created module should have one clear responsibility.



Avoid:



```text

God components

God services

God controllers

God utility files

```



Prefer:



```text

small modules

clear naming

typed interfaces

reusable services

simple hooks

isolated responsibilities

```



Use existing project conventions where possible.



Do not introduce unnecessary abstraction.



\---



\# 43. IMPORTANT FRONTEND RULE



A file being small is NOT enough.



The code must remain understandable.



Bad refactoring:



```text

20,000 lines

→

100 files of 200 lines

```



if those files have no meaningful separation.



Good refactoring:



```text

Page

&#x20;├── Layout

&#x20;├── Sidebar

&#x20;├── Chat

&#x20;├── Editor

&#x20;├── Preview

&#x20;├── Project Files

&#x20;├── Hooks

&#x20;├── API Services

&#x20;└── Types

```



Each part owns its responsibility.



\---



\# 44. IMPORTANT BACKEND RULE



Use separation such as:



```text

Route

→ Controller

→ Service

→ Repository

→ Database

```



where appropriate.



AI-specific logic should be isolated.



Payment logic should be isolated.



Token logic should be isolated.



Memory logic should be isolated.



Authentication logic should be isolated.



This makes future changes much easier.



\---



\# 45. SCALABILITY



The architecture should be prepared for significant future traffic.



Do not optimize prematurely, but avoid obvious architectural bottlenecks.



Important principles:



\* stateless API design where practical,

\* proper database indexes,

\* pagination for history,

\* efficient queries,

\* avoid loading all conversations at once,

\* avoid loading entire project histories unnecessarily,

\* centralized AI service,

\* usage limits,

\* rate limiting,

\* caching where genuinely useful,

\* background processing where appropriate,

\* clean service boundaries.



The application should be capable of evolving without rewriting the entire backend.



\---



\# 46. HISTORY PAGINATION



Do not load thousands of messages/conversations at once.



Implement pagination or cursor-based loading where appropriate.



For example:



```text

GET /conversations?page=1

```



or a cursor-based equivalent.



The frontend should load more when necessary.



\---



\# 47. PROJECT FILE MANAGEMENT



Generated project files should be represented cleanly.



Avoid putting an entire huge project into one giant database string if the existing architecture can support structured project files.



Conceptually:



```text

Project

&#x20;↓

ProjectFile

&#x20;├── path

&#x20;├── content

&#x20;├── language

&#x20;└── updated\_at

```



The AI should be able to update specific files without unnecessarily replacing the entire project.



\---



\# 48. DOWNLOAD / EXPORT



Preserve or implement project export where intended.



The user should be able to download generated project files as a ZIP where appropriate.



The backend should generate the ZIP safely.



Do not allow arbitrary filesystem access through user-controlled paths.



Prevent path traversal vulnerabilities.



\---



\# 49. API RESPONSE CONSISTENCY



Create consistent response formats.



For example:



```text

success

data

error

message

```



Use the application's existing convention if one already exists.



Do not mix five different response formats.



\---



\# 50. DOCUMENTATION



Create/update documentation for:



```text

Project architecture

Environment variables

How to run backend

How to run frontend

Database setup

Authentication

AI providers

Token system

Payment system

Important API endpoints

```



Do not document secrets.



\---



\# 51. FINAL DIRECTORY QUALITY



At the end, the repository should be understandable to another developer.



A developer should be able to quickly answer:



```text

Where is authentication?

Where is Chat?

Where is Code?

Where is AI?

Where is memory?

Where are projects?

Where are tokens?

Where is payment?

Where is the database?

Where are API calls?

Where are shared types?

```



without searching through 20,000-line files.



\---



\# 52. FINAL ACCEPTANCE CRITERIA



The task is complete ONLY when all of the following are true:



\## Authentication



\* Login works.

\* Logout works.

\* Auth persists correctly.

\* Current user is correctly identified.

\* Protected routes work.



\## User Identity



\* User data comes from the real authenticated account.

\* AI/application can access appropriate user information.

\* No hardcoded user identity.



\## User Isolation



\* Users can only access their own data.

\* Conversations are private.

\* Memory is private.

\* Projects are private.

\* Token balances are private.

\* Payment records are private.



\## Chat



\* Chat works.

\* Messages persist.

\* History works.

\* Memory works.

\* Token usage is recorded.



\## Code



\* Code page works.

\* AI request works.

\* AI response works.

\* Code generation works.

\* Project context works.

\* Generated work persists.

\* Existing UI remains intact as much as possible.



\## Memory



\* User memory persists.

\* Chat can use it.

\* Code can use it.

\* Memory is user-specific.



\## Tokens



\* Token balance exists.

\* Usage is recorded.

\* Tokens are deducted correctly.

\* Insufficient balance is handled.

\* Limits are enforced server-side.



\## Payment



\* Payment page exists/integrates with the chosen provider architecture.

\* Payment is verified server-side.

\* Duplicate crediting is prevented.

\* Tokens are credited only after verification.

\* Premium access is granted only after verified payment/entitlement.



\## Architecture



\* Huge files are split.

\* No unnecessary giant files remain.

\* Responsibilities are separated.

\* Duplicate logic is reduced.

\* Frontend and backend are easier to understand.



\## Quality



\* No obvious TypeScript/build errors.

\* No obvious backend startup errors.

\* No exposed secrets.

\* No fake implementations.

\* No accidental deletion of working features/data.



\---



\# 53. FINAL EXECUTION INSTRUCTION



Before changing code, inspect the ENTIRE relevant codebase.



Do not start by guessing.



First understand what already exists.



Then make a plan internally.



Then implement incrementally.



For every major change:



1\. inspect,

2\. modify,

3\. validate,

4\. continue.



If an existing implementation already satisfies a requirement, reuse it instead of creating a duplicate.



If two systems currently perform the same job, consolidate them carefully.



If a large file contains multiple responsibilities, split it into logical modules.



If splitting a file requires import/path/state changes, update all dependent files.



After refactoring, verify that the application still starts and functions.



DO NOT stop after only creating a beautiful folder structure.



The final goal is a \*\*WORKING Vatsa AI\*\*, not merely a refactored-looking repository.



The priority order is:



```text

WORKING

↓

CORRECT

↓

SECURE

↓

USER-ISOLATED

↓

SCALABLE

↓

MODULAR

↓

CLEAN

```



Do not sacrifice functionality for architecture.



Do not sacrifice security for convenience.



Do not sacrifice existing working features for unnecessary redesign.



Build the missing pieces around the existing Vatsa AI product and make the whole system function as one coherent application.



