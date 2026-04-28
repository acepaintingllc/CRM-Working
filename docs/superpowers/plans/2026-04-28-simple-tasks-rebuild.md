# Simple Tasks Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Notes module with a simple Tasks feature for personal tasks and optional CRM follow-ups.

**Architecture:** Create a new `tasks` domain instead of carrying the old notes/folders/reminders model forward. The API owns auth, validation, persistence, and response envelopes; client hooks own list/form orchestration; the page stays a shared CRM UI composition.

**Tech Stack:** Next.js route handlers, React client components, Supabase service role access, Vitest/component tests, SQL migrations.

---

### Task 1: Schema

**Files:**
- Create: `supabase/sql/070_simple_tasks_rebuild.sql`

- [ ] Drop old notes module tables.
- [ ] Create `public.tasks` with `title`, `description`, `status`, `due_at`, optional `customer_id`, `job_id`, `estimate_id`, and timestamps.
- [ ] Add org/status/due and relationship indexes.

### Task 2: Domain And API

**Files:**
- Create: `lib/tasks/types.ts`
- Create: `lib/tasks/server.ts`
- Create: `lib/tasks/pagination.ts`
- Create: `lib/tasks/client/useTasks.ts`
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/tasks/[id]/complete/route.ts`
- Create: `app/api/tasks/[id]/reopen/route.ts`
- Test: `app/api/tasks/__tests__/TasksRoutes.test.tsx`

- [ ] Write route tests for create/list, CRM links, complete, reopen, and delete.
- [ ] Verify tests fail against missing `/api/tasks` implementation.
- [ ] Implement validation and route handlers.
- [ ] Verify route tests pass.

### Task 3: UI

**Files:**
- Create: `app/crm/tasks/page.tsx`
- Create: `app/crm/tasks/_components/TaskFormPanel.tsx`
- Create: `app/crm/tasks/_components/TaskRows.tsx`
- Test: `app/crm/tasks/__tests__/TasksPage.test.tsx`
- Modify: `app/crm/layout.tsx`

- [ ] Write page tests for the simplified list, filters, quick create, done/reopen actions, and no notes tab.
- [ ] Verify tests fail against missing UI.
- [ ] Implement shared CRM UI page.
- [ ] Update main nav from Notes to Tasks.
- [ ] Verify page tests pass.

### Task 4: Home Integration

**Files:**
- Modify: `lib/crm/home/types.ts`
- Modify: `lib/crm/home/state.ts`
- Modify: `lib/crm/home/selectors.ts`
- Modify: `lib/crm/home/loader.ts`
- Modify: `app/crm/_home/viewModel.ts`
- Update corresponding home tests.

- [ ] Rename home reminder source from notes to tasks.
- [ ] Load `/api/tasks/dashboard` or a simple `/api/tasks?status=open&due=today` equivalent.
- [ ] Update links to `/crm/tasks`.
- [ ] Verify home tests pass.

### Task 5: Remove Old Notes Surface

**Files:**
- Delete old `app/crm/notes`, `app/api/notes`, and unused `lib/notes` files after the new task surface compiles.
- Update `package.json` test glob if `lib/notes` tests are removed.

- [ ] Remove obsolete notes routes, pages, hooks, and tests.
- [ ] Run `rg "crm/notes|api/notes|lib/notes|Notes Module"` and eliminate app-facing references.
- [ ] Run targeted tests and `npm run typecheck`.
