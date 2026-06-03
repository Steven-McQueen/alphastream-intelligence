# AlphaStream Chat Architecture Overview

> Read-only inspection of the current implementation as of May 24, 2026.  
> Every statement is verified from code unless marked otherwise.

| Metric | Value |
|--------|-------|
| Backend files | 7 |
| Frontend files | 8 |
| DB tables | 2 |
| Supabase projects | 2 (⚠️ split architecture) |

---

## 1. Executive Summary

AlphaStream's chat system has two independent subsystems sharing a single UI surface:

**Streaming chat** — the user sends a message, the frontend POSTs to `/api/chat` (no auth required), the backend pipes it through a Gemini provider via SSE, and tokens stream back in real time. This path is stateless and in-memory.

**Persistence** — after the stream completes, the frontend's `onStreamComplete` callback creates a thread (if needed) and saves both messages via authenticated POSTs to `/api/chat/threads`. This path requires a valid Supabase JWT, verified by calling the Supabase Auth API.

Authentication originates from Supabase project `cxwhyfieuwjuuqdgipbn` (frontend auth). Data is stored in a separate Supabase project `pjqiomrrnovfryypamat` (backend database). The backend connects to the database as the `postgres` role with `BYPASSRLS`, so RLS policies do not affect the write path.

---

## 2. File Responsibility Map

### Backend

| File | Responsibility | Auth required |
|------|---------------|---------------|
| `routes/chat.py` | POST /api/chat — SSE streaming to Gemini | No |
| `routes/chat_threads.py` | CRUD for threads + messages (5 endpoints) | Yes — JWT |
| `services/chat/chat_service.py` | System prompt assembly, SSE formatting, provider dispatch | — |
| `services/chat/gemini_provider.py` | Gemini SDK wrapper (sync + async streaming) | — |
| `middleware/supabase_auth.py` | JWT verification via Supabase Auth API (primary) or HS256 (fallback) | — |
| `database/chat_store.py` | Raw SQL persistence: threads + messages + retention | — |
| `config.py` | Loads SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, DATABASE_URL | — |
| `main.py` | Registers both chat routers on the FastAPI app | — |
| `services/refresh_scheduler.py` | Schedules chat_retention_job daily at 03:30 | — |

### Frontend

| File | Responsibility |
|------|---------------|
| `hooks/useChatStream.ts` | SSE streaming hook — sends messages, accumulates tokens, fires onStreamComplete |
| `pages/Intelligence.tsx` | Orchestrates chat + persistence: reads ?thread= param, creates/restores threads |
| `lib/authFetch.ts` | Attaches Authorization: Bearer header to fetch calls via Supabase session |
| `contexts/ChatHistoryContext.tsx` | React context wrapping thread CRUD API calls + thread list state |
| `components/chat/ChatHistoryList.tsx` | Sidebar thread list with navigation, delete, and active-thread highlight |
| `components/chat/ChatOverlay.tsx` | Chat UI component (input, message bubbles, Markdown rendering) |
| `context/AuthContext.tsx` | Supabase Auth session management, idle timeout, login/signup |
| `integrations/supabase/client.ts` | Supabase JS client initialization (project cxwhyfieuwjuuqdgipbn) |
| `components/layout/AppSidebar.tsx` | Left sidebar — embeds ChatHistoryList between nav and watchlist |
| `App.tsx` | Provider tree: Auth → Portfolio → Market → Watchlist → ChatHistory → StockDetail |

---

## 3. User Handling

| Step | Where | Detail |
|------|-------|--------|
| Identity origin | Supabase Auth (project cxwhyfieuwjuuqdgipbn) | Users sign up / log in via email+password. Supabase issues a JWT with sub=user UUID. |
| Frontend session | AuthContext.tsx → supabase.auth.onAuthStateChange | Session stored in localStorage, auto-refreshed. Exposed as context.user and context.session. |
| Token attachment | authFetch.ts → supabase.auth.getSession() | Reads access_token from the Supabase client; attaches Authorization: Bearer on every authFetch/authJson call. |
| Backend extraction | middleware/supabase_auth.py → get_current_user_id() | Calls GET /auth/v1/user on the auth Supabase project. Returns data.id as user_id string. |
| Ownership enforcement | database/chat_store.py | Every SQL query includes WHERE user_id = :uid. No cross-user access possible at the query level. |

---

## 4. Authentication

The middleware in `supabase_auth.py` implements a two-tier strategy:

**Primary — Supabase Auth API** (active when SUPABASE_URL + SUPABASE_ANON_KEY are set): sends the bearer token to `GET {SUPABASE_URL}/auth/v1/user` with the apikey header. If the response is 200, extracts `data.id` as the user UUID. Handles 401/403 as "invalid token". Uses a module-level `aiohttp.ClientSession` for connection pooling.

**Fallback — local HS256 decode** (active when only SUPABASE_JWT_SECRET is set): uses PyJWT to decode the token locally with `algorithms=["HS256"]` and `audience="authenticated"`. Extracts `payload.sub`. Currently non-functional because the configured secret is incorrect.

> ⚠️ **Two-project architecture:** Frontend authenticates against Supabase project cxwhyfieuwjuuqdgipbn. Backend stores data in project pjqiomrrnovfryypamat. The Auth API call goes to the correct auth project. The HS256 fallback would require the JWT secret from the auth project, which is not currently configured correctly.

---

## 5. Authorization

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Backend route | Depends(get_current_user_id) on all 5 thread endpoints | Enforced |
| Backend SQL | Every query filters by user_id parameter | Enforced |
| Database RLS | Enabled on chat_threads + chat_messages, but zero policies defined | Bypassed (postgres role has BYPASSRLS) |
| Streaming endpoint | POST /api/chat has NO auth dependency | Open — anyone on the network can stream |

> ℹ️ **Streaming is intentionally unauthenticated.** The Gemini streaming endpoint (/api/chat) does not require a JWT. This means the LLM is accessible to any caller who can reach the backend. Persistence is auth-gated, but the AI itself is not.

---

## 6. Conversation Storage Model

### chat_threads

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Server-generated via Python uuid4() |
| user_id | UUID (NOT NULL) | Owner — from JWT sub claim |
| title | TEXT | Derived from first user message, truncated to ~55 chars |
| context_label | TEXT (nullable) | e.g. 'Assistant' — what mode the chat was in |
| chat_mode | TEXT (nullable) | e.g. 'Portfolio' — reserved for future specialized modes |
| route_path | TEXT (nullable) | e.g. '/intelligence' — where the chat originated |
| created_at | TIMESTAMPTZ | Thread creation time (UTC) |
| updated_at | TIMESTAMPTZ | Refreshed on every new message |
| expires_at | TIMESTAMPTZ | Default: NOW() + 14 days, slides on each message |

### chat_messages

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Server-generated via Python uuid4() |
| thread_id | UUID (FK → chat_threads.id, ON DELETE CASCADE) | Parent thread |
| role | TEXT (CHECK: 'user' \| 'assistant') | Message author |
| content | TEXT | Raw Markdown text |
| created_at | TIMESTAMPTZ | Message creation time (UTC) |

**Indexes:** (user_id, updated_at DESC) on threads; (thread_id, created_at ASC) on messages; (expires_at) on threads for retention cleanup.

---

## 7. End-to-End Flow

Walk-through of one complete message cycle (first message in a new conversation):

| Step | Component | Action |
|------|-----------|--------|
| 1 | User | Types message in ChatOverlay, hits Enter |
| 2 | ChatOverlay | Calls chat.sendMessage(text) — delegates to useChatStream |
| 3 | useChatStream | Creates user + empty assistant message objects in React state. POSTs to /api/chat (no auth) with full message history. |
| 4 | routes/chat.py | Receives ChatRequest. Calls chat_service.stream_chat(). |
| 5 | chat_service.py | Builds system prompt, normalizes messages, calls gemini_provider.stream_chat(). |
| 6 | gemini_provider.py | Creates Gemini streaming client, offloads each next() to thread pool, yields text chunks. |
| 7 | chat_service.py | Wraps each chunk as SSE event: `data: {"token": "..."}`. Final: `data: {"done": true}`. |
| 8 | useChatStream | Reads SSE stream, accumulates finalAssistantContent. Appends tokens to assistant message in React state. |
| 9 | useChatStream | Stream ends → calls onCompleteRef.current(userContent, assistantContent). |
| 10 | Intelligence.tsx | handleStreamComplete fires. activeThreadRef is null → calls createThread() via ChatHistoryContext. |
| 11 | ChatHistoryContext | authJson POST /api/chat/threads with {title, context_label, route_path}. authFetch attaches Bearer token. |
| 12 | supabase_auth.py | Validates token via Supabase Auth API → returns user_id. |
| 13 | chat_store.py | INSERT INTO chat_threads → commit → returns {id: uuid}. |
| 14 | Intelligence.tsx | Sets activeThreadRef = tid. Calls saveMessage(tid, 'user', content) then saveMessage(tid, 'assistant', content). |
| 15 | chat_store.py | For each: verifies thread ownership, INSERT INTO chat_messages, UPDATE chat_threads.updated_at/expires_at → commit. |
| 16 | Intelligence.tsx | Calls refreshThreads() → ChatHistoryContext fetches GET /api/chat/threads → sidebar updates. |
| 17 | Intelligence.tsx | Sets URL to ?thread=tid (skipNextRestoreRef prevents re-fetching the thread we just created). |

> For a subsequent message in the same thread, steps 10–11 are skipped (activeThreadRef already has the thread ID). Steps 14–15 save directly.

---

## 8. Data Lifecycle

| Event | What happens |
|-------|-------------|
| Thread created | INSERT with expires_at = NOW() + 14 days. Title derived from first user message (truncated to 55 chars with word-boundary ellipsis). |
| Message appended | INSERT into chat_messages. UPDATE chat_threads SET updated_at = NOW(), expires_at = NOW() + 14 days. Sliding window. |
| Thread listed | SELECT WHERE user_id = :uid AND expires_at > NOW(). Expired threads are excluded from results but not yet deleted. |
| Thread loaded | SELECT thread + SELECT messages WHERE thread_id ORDER BY created_at ASC. Also filters by expires_at > NOW(). |
| Retention cleanup | Scheduled via refresh_scheduler.py at 03:30 daily. Calls DELETE FROM chat_threads WHERE expires_at < NOW(). CASCADE deletes messages. |
| Manual delete | DELETE FROM chat_threads WHERE id = :tid AND user_id = :uid. No expires_at filter (can delete expired threads too). |

---

## 9. Current Restore Behavior

When a user clicks a thread in the sidebar, `ChatHistoryList` navigates to `/intelligence?thread=<id>`. Intelligence.tsx reads the param, calls `loadThread(id)` via ChatHistoryContext, and hydrates `useChatStream` with `setInitialMessages()`.

| Metadata | Stored | Restored on reopen |
|----------|--------|--------------------|
| Message history | Yes (chat_messages) | Yes — full conversation loaded |
| Thread title | Yes | Yes — shown in sidebar |
| context_label | Yes | No — not read back into the UI |
| chat_mode | Yes | No — not read back into the UI |
| route_path | Yes (e.g. /intelligence) | No — all restores open in /intelligence regardless |
| Active tab (agent/database/explanation) | No | No — always defaults to 'agent' tab |

The `route_path` field is stored for future use but is not currently used to determine where to reopen a thread. All threads reopen in `/intelligence`.

---

## 10. Risks & Technical Debt

### 🔴 High — Unauthenticated LLM endpoint

POST /api/chat has no auth. Any network-reachable client can call Gemini through your backend, consuming your API quota. The streaming endpoint and the persistence endpoints have fundamentally different auth postures.

### 🔴 High — Two-project Supabase architecture

Auth is on project cxwhyfieuwjuuqdgipbn; data is on project pjqiomrrnovfryypamat. User UUIDs from the auth project are stored as opaque foreign keys in the data project. There is no referential integrity between auth.users and chat_threads.user_id. If the auth project changes, user_ids become orphaned.

### 🟡 Medium — Auth API round-trip on every request

The primary auth method calls Supabase's /auth/v1/user endpoint on every authenticated request. This adds ~100–300ms latency per call and creates a dependency on Supabase API availability. A local JWT decode with the correct secret would be faster and work offline.

### 🟡 Medium — Persistence errors are silently swallowed

ChatHistoryContext catches all API errors and logs to console.error. The user sees no indication that their thread failed to save. If createThread returns null, handleStreamComplete exits early — the conversation appears to work but nothing is persisted.

### 🟡 Medium — Sync DB calls inside async handlers

chat_store.py uses synchronous SQLAlchemy operations called from async FastAPI route handlers. FastAPI offloads these to a thread pool, but under load this can exhaust the pool. The Gemini provider correctly uses run_in_executor; the DB layer does not.

### 🔵 Low — RLS enabled with no policies

chat_threads and chat_messages have RLS enabled but zero policies. The postgres role bypasses RLS (rolbypassrls=true), so the backend is unaffected. But if any Supabase client library or Edge Function tries to access these tables directly, it will be blocked.

### 🔵 Low — Duplicate connection pools

chat_store.py creates its own SQLAlchemy engine (pool_size=3, max_overflow=5) separate from postgres_manager.py's engine (pool_size=5, max_overflow=10). Both point to the same DATABASE_URL. Total: up to 23 connections from one backend instance.

### 🔵 Low — Invalid UUID thread_id returns 500 instead of 404

thread_id is typed as str, not validated as UUID. Passing a non-UUID string causes PostgreSQL to raise "invalid input syntax for type uuid" which propagates as an unhandled 500 error.

---

*Generated from codebase inspection — May 24, 2026*
