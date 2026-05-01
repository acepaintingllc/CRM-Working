# Accepted Estimate Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make accepted public estimates the canonical operational source for later work orders and invoices.

**Architecture:** Acceptance remains initiated through the public quote portal, but the side effects move into a shared server workflow that updates the public version, canonical estimate, and linked job together. Jobs get one explicit accepted estimate link, and downstream work-order/invoice features will read from a stable accepted-estimate source instead of guessing from the first estimate version.

**Tech Stack:** Next.js route handlers, Supabase SQL, TypeScript service modules, Node test runner, Vitest component/route tests.

---

## File Structure

- Modify `supabase/sql/074_accepted_estimate_ownership.sql`
  - Adds accepted estimate ownership columns and constraints.
- Modify `lib/server/estimatePublicPortal.ts`
  - Delegates acceptance persistence to a new operational workflow helper.
- Create `lib/server/accepted-estimates/service.ts`
  - Owns accepted estimate side effects and accepted source read model.
- Create `lib/server/accepted-estimates/types.ts`
  - Defines accepted estimate source contracts for future work orders/invoices.
- Create `lib/server/accepted-estimates/__tests__/service.test.ts`
  - Covers acceptance side effects and source read-model behavior.
- Modify `lib/jobs/serviceCore.ts`
  - Uses `jobs.linked_estimate_id` as the canonical link before falling back.
- Modify `lib/jobs/service.ts`
  - Selects `linked_estimate_id` from job rows.
- Modify `lib/jobs/__tests__/service.test.ts`
  - Covers explicit job link precedence.
- Modify `app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx`
  - Verifies public acceptance calls the operational acceptance workflow.
- Modify `docs/jobs-architecture.md`
  - Documents accepted-estimate link ownership.
- Modify `docs/quote-estimate-architecture.md`
  - Documents public acceptance side effects.

---

### Task 1: Add Accepted Ownership Schema

**Files:**
- Create: `supabase/sql/074_accepted_estimate_ownership.sql`

- [ ] **Step 1: Create the migration**

```sql
alter table public.estimates
  add column if not exists accepted_at timestamptz null,
  add column if not exists accepted_public_version_id uuid null references public.estimate_public_versions(id) on delete set null;

alter table public.jobs
  add column if not exists linked_estimate_id uuid null references public.estimates(id) on delete set null;

create unique index if not exists estimates_one_accepted_public_version_idx
  on public.estimates (org_id, accepted_public_version_id)
  where accepted_public_version_id is not null;

create index if not exists estimates_org_accepted_at_idx
  on public.estimates (org_id, accepted_at desc)
  where accepted_at is not null;

create index if not exists jobs_org_linked_estimate_idx
  on public.jobs (org_id, linked_estimate_id)
  where linked_estimate_id is not null;
```

- [ ] **Step 2: Run migration-text checks**

Run: `rg --line-number "accepted_public_version_id|linked_estimate_id|estimates_one_accepted" supabase/sql/074_accepted_estimate_ownership.sql`

Expected: shows the new accepted estimate columns, job link column, and indexes.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/074_accepted_estimate_ownership.sql
git commit -m "db: add accepted estimate ownership fields"
```

---

### Task 2: Define Accepted Estimate Contracts

**Files:**
- Create: `lib/server/accepted-estimates/types.ts`

- [ ] **Step 1: Add server contracts**

```ts
export type AcceptedEstimateSource = {
  org_id: string
  job_id: string
  estimate_id: string
  customer_id: string | null
  accepted_public_version_id: string
  accepted_at: string
  version_name: string | null
  version_state: string | null
  final_total: number
  snapshot_json: Record<string, unknown>
}

export type AcceptEstimateOperationalInput = {
  orgId: string
  jobId: string
  estimateId: string
  publicVersionId: string
  acceptedAt: string
}
```

- [ ] **Step 2: Run typecheck for the new type file**

Run: `npm.cmd run typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/server/accepted-estimates/types.ts
git commit -m "chore: define accepted estimate source contracts"
```

---

### Task 3: Build Operational Acceptance Service

**Files:**
- Create: `lib/server/accepted-estimates/service.ts`
- Create: `lib/server/accepted-estimates/__tests__/service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildAcceptedEstimateSource,
  buildAcceptedEstimateUpdatePlan,
} from '../service.ts'

test('buildAcceptedEstimateUpdatePlan links the accepted estimate to its job', () => {
  const plan = buildAcceptedEstimateUpdatePlan({
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.deepEqual(plan.estimateUpdate, {
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_public_version_id: 'public-version-1',
    version_state: 'live',
  })
  assert.deepEqual(plan.jobUpdate, {
    linked_estimate_id: 'estimate-1',
    status: 'scheduled',
  })
})

test('buildAcceptedEstimateSource uses rollup total and public snapshot as invoice/work-order source', () => {
  const source = buildAcceptedEstimateSource({
    estimate: {
      org_id: 'org-1',
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Interior repaint',
      version_state: 'live',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_public_version_id: 'public-version-1',
    },
    publicVersion: {
      id: 'public-version-1',
      snapshot_json: { document: { title: 'Quote' } },
    },
    rollup: {
      final_total: 4250,
    },
  })

  assert.deepEqual(source, {
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    customer_id: 'customer-1',
    accepted_public_version_id: 'public-version-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    version_name: 'Interior repaint',
    version_state: 'live',
    final_total: 4250,
    snapshot_json: { document: { title: 'Quote' } },
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: fails because `service.ts` does not exist.

- [ ] **Step 3: Implement pure helpers**

```ts
import type {
  AcceptedEstimateSource,
  AcceptEstimateOperationalInput,
} from './types.ts'

type Unsafe = Record<string, unknown>

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function buildAcceptedEstimateUpdatePlan(input: AcceptEstimateOperationalInput) {
  return {
    estimateUpdate: {
      accepted_at: input.acceptedAt,
      accepted_public_version_id: input.publicVersionId,
      version_state: 'live',
    },
    jobUpdate: {
      linked_estimate_id: input.estimateId,
      status: 'scheduled',
    },
  }
}

export function buildAcceptedEstimateSource(params: {
  estimate: Unsafe
  publicVersion: Unsafe
  rollup?: Unsafe | null
}): AcceptedEstimateSource {
  return {
    org_id: asText(params.estimate.org_id),
    job_id: asText(params.estimate.job_id),
    estimate_id: asText(params.estimate.id),
    customer_id: asText(params.estimate.customer_id) || null,
    accepted_public_version_id: asText(params.estimate.accepted_public_version_id),
    accepted_at: asText(params.estimate.accepted_at),
    version_name: asText(params.estimate.version_name) || null,
    version_state: asText(params.estimate.version_state) || null,
    final_total: asNumber(params.rollup?.final_total),
    snapshot_json: (params.publicVersion.snapshot_json ?? {}) as Record<string, unknown>,
  }
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/server/accepted-estimates
git commit -m "test: add accepted estimate ownership helpers"
```

---

### Task 4: Persist Acceptance Side Effects

**Files:**
- Modify: `lib/server/accepted-estimates/service.ts`
- Modify: `lib/server/accepted-estimates/__tests__/service.test.ts`

- [ ] **Step 1: Add tests for persistence sequencing**

Add this test to `lib/server/accepted-estimates/__tests__/service.test.ts`:

```ts
import { applyAcceptedEstimateSideEffects } from '../service.ts'

test('applyAcceptedEstimateSideEffects updates estimate then job', async () => {
  const calls: Array<{ table: string; payload: Record<string, unknown>; filters: Record<string, unknown> }> = []
  const db = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              const filters: Record<string, unknown> = { [column]: value }
              return {
                eq(nextColumn: string, nextValue: unknown) {
                  filters[nextColumn] = nextValue
                  calls.push({ table, payload, filters })
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      }
    },
  }

  const result = await applyAcceptedEstimateSideEffects(db, {
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, [
    {
      table: 'estimates',
      payload: {
        accepted_at: '2026-04-29T10:00:00.000Z',
        accepted_public_version_id: 'public-version-1',
        version_state: 'live',
      },
      filters: { org_id: 'org-1', id: 'estimate-1' },
    },
    {
      table: 'jobs',
      payload: {
        linked_estimate_id: 'estimate-1',
        status: 'scheduled',
      },
      filters: { org_id: 'org-1', id: 'job-1' },
    },
  ])
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: fails because `applyAcceptedEstimateSideEffects` is not exported.

- [ ] **Step 3: Implement persistence helper**

Append this to `lib/server/accepted-estimates/service.ts`:

```ts
import { errorResult, okResult, type ServiceResult } from '@/lib/server/serviceResult'

type DbUpdateChain = {
  from(table: string): {
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): Promise<{ error: { message?: string } | null }>
      }
    }
  }
}

export async function applyAcceptedEstimateSideEffects(
  db: DbUpdateChain,
  input: AcceptEstimateOperationalInput
): Promise<ServiceResult<{ ok: true }>> {
  const plan = buildAcceptedEstimateUpdatePlan(input)

  const estimateUpdate = await db
    .from('estimates')
    .update(plan.estimateUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.estimateId)

  if (estimateUpdate.error) {
    return errorResult('server_error', estimateUpdate.error.message ?? 'Unable to mark estimate accepted')
  }

  const jobUpdate = await db
    .from('jobs')
    .update(plan.jobUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.jobId)

  if (jobUpdate.error) {
    return errorResult('server_error', jobUpdate.error.message ?? 'Unable to link accepted estimate to job')
  }

  return okResult({ ok: true })
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: all accepted-estimate service tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/server/accepted-estimates
git commit -m "feat: persist accepted estimate job ownership"
```

---

### Task 5: Wire Public Acceptance To Operational Ownership

**Files:**
- Modify: `lib/server/estimatePublicPortal.ts`
- Modify: `app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx`

- [ ] **Step 1: Add failing workflow assertion**

In `app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx`, extend the existing accepted-quote test so the mocked DB expects updates to `estimates` and `jobs` after the public version is accepted. The expected payloads are:

```ts
{
  accepted_at: '2026-04-01T00:00:00.000Z',
  accepted_public_version_id: 'public-version-1',
  version_state: 'live',
}
```

and:

```ts
{
  linked_estimate_id: 'estimate-1',
  status: 'scheduled',
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm.cmd run test:components -- app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx`

Expected: fails because `acceptPublicEstimate` only updates `estimate_public_versions`.

- [ ] **Step 3: Call side-effect service from acceptance**

In `lib/server/estimatePublicPortal.ts`, import:

```ts
import { applyAcceptedEstimateSideEffects } from './accepted-estimates/service'
```

After the public version update succeeds and before writing the accepted event, add:

```ts
  const ownershipResult = await applyAcceptedEstimateSideEffects(supabaseAdmin, {
    orgId,
    jobId: asText(loaded.version.job_id || updateResult.data.job_id || loaded.snapshot.document?.job?.id),
    estimateId: asText(updateResult.data.estimate_id),
    publicVersionId: versionId,
    acceptedAt: now,
  })
  if (!ownershipResult.ok) return ownershipResult
```

If `estimate_public_versions` does not currently carry `job_id`, load the base estimate inside `acceptPublicEstimate` before calling the helper:

```ts
  const estimateLookup = await supabaseAdmin
    .from('estimates')
    .select('id, job_id')
    .eq('org_id', orgId)
    .eq('id', asText(updateResult.data.estimate_id))
    .maybeSingle()
  if (estimateLookup.error || !estimateLookup.data) {
    return errorResult('server_error', estimateLookup.error?.message ?? 'Accepted estimate missing')
  }
```

Then pass `jobId: asText(estimateLookup.data.job_id)`.

- [ ] **Step 4: Run public acceptance tests**

Run: `npm.cmd run test:components -- app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx app/api/__tests__/QuotePublicRoute.test.tsx`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/server/estimatePublicPortal.ts app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx
git commit -m "feat: link accepted quotes to jobs"
```

---

### Task 6: Make Job Detail Respect Explicit Accepted Link

**Files:**
- Modify: `lib/jobs/service.ts`
- Modify: `lib/jobs/serviceCore.ts`
- Modify: `lib/jobs/__tests__/service.test.ts`

- [ ] **Step 1: Add failing precedence test**

Add this to `lib/jobs/__tests__/service.test.ts`:

```ts
test('jobs service helpers prefer explicit linked_estimate_id over first estimate row', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
      linked_estimate_id: 'accepted-estimate',
    },
    optionalColumns: ['linked_estimate_id'],
    linkedEstimates: [
      { id: 'draft-estimate', status: 'draft', version_name: null, version_state: 'draft', version_kind: null, version_sort_order: 1, created_at: null, updated_at: null },
      { id: 'accepted-estimate', status: 'ready', version_name: null, version_state: 'live', version_kind: null, version_sort_order: 2, created_at: null, updated_at: null },
    ],
  })

  assert.equal(detail.linked_estimate_id, 'accepted-estimate')
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `node --experimental-specifier-resolution=node --test lib/jobs/__tests__/service.test.ts`

Expected: fails because job detail currently picks the first linked estimate.

- [ ] **Step 3: Select and map explicit job link**

In `lib/jobs/service.ts`, add `linked_estimate_id` to `detailJobColumns` and `listJobColumns` if the schema helper allows it through optional columns. In `lib/jobs/serviceCore.ts`, change:

```ts
linked_estimate_id: null,
```

to:

```ts
linked_estimate_id: asString(safeRow.linked_estimate_id),
```

and change:

```ts
linked_estimate_id: params.linkedEstimates?.[0]?.id ?? null,
```

to:

```ts
linked_estimate_id: summary.linked_estimate_id ?? params.linkedEstimates?.[0]?.id ?? null,
```

- [ ] **Step 4: Run jobs tests**

Run: `node --experimental-specifier-resolution=node --test lib/jobs/__tests__/service.test.ts`

Expected: all jobs service tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/service.ts lib/jobs/serviceCore.ts lib/jobs/__tests__/service.test.ts
git commit -m "fix: prefer explicit accepted estimate job link"
```

---

### Task 7: Add Accepted Estimate Source Loader

**Files:**
- Modify: `lib/server/accepted-estimates/service.ts`
- Modify: `lib/server/accepted-estimates/__tests__/service.test.ts`

- [ ] **Step 1: Add failing source loader test**

Add a test proving `loadAcceptedEstimateSource(db, orgId, jobId)` queries the linked estimate, accepted public version, and rollup, then returns `AcceptedEstimateSource`.

Expected result:

```ts
{
  org_id: 'org-1',
  job_id: 'job-1',
  estimate_id: 'estimate-1',
  customer_id: 'customer-1',
  accepted_public_version_id: 'public-version-1',
  accepted_at: '2026-04-29T10:00:00.000Z',
  version_name: 'Interior repaint',
  version_state: 'live',
  final_total: 4250,
  snapshot_json: { document: { title: 'Quote' } },
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: fails because `loadAcceptedEstimateSource` does not exist.

- [ ] **Step 3: Implement loader**

Implement `loadAcceptedEstimateSource(db, orgId, jobId)` in `lib/server/accepted-estimates/service.ts`:

1. Read `jobs.id, linked_estimate_id` by `org_id` and `id`.
2. If no job, return `not_found`.
3. If no `linked_estimate_id`, return `invalid_input` with `Job has no accepted estimate`.
4. Read the linked `estimates` row including `accepted_at` and `accepted_public_version_id`.
5. If missing accepted fields, return `invalid_input` with `Linked estimate is not accepted`.
6. Read `estimate_public_versions.id, snapshot_json`.
7. Read optional `estimate_version_rollups.final_total`.
8. Return `buildAcceptedEstimateSource`.

- [ ] **Step 4: Run tests**

Run: `node --experimental-specifier-resolution=node --test lib/server/accepted-estimates/__tests__/service.test.ts`

Expected: all accepted-estimate service tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/server/accepted-estimates
git commit -m "feat: load accepted estimate source"
```

---

### Task 8: Document Ownership Rules

**Files:**
- Modify: `docs/jobs-architecture.md`
- Modify: `docs/quote-estimate-architecture.md`

- [ ] **Step 1: Update jobs architecture**

Add this to `docs/jobs-architecture.md` under Ownership:

```md
- `jobs.linked_estimate_id` is the canonical accepted estimate link for operational work after a quote is accepted.
- Public quote acceptance is the normal writer of `jobs.linked_estimate_id`.
- Job detail may fall back to linked estimate rows only for legacy data where `jobs.linked_estimate_id` is null.
- Work orders and invoices must read accepted estimate source data through `lib/server/accepted-estimates/service.ts`, not by picking the first estimate for a job.
```

- [ ] **Step 2: Update quote architecture**

Add this to `docs/quote-estimate-architecture.md` under Server Layer:

```md
### Public acceptance ownership

When a public quote is accepted, `lib/server/estimatePublicPortal.ts` updates the public version and delegates operational side effects to `lib/server/accepted-estimates/service.ts`.

Acceptance side effects:
- mark the canonical estimate accepted
- set the estimate version state to `live`
- link the accepted estimate to the job through `jobs.linked_estimate_id`
- preserve the public version snapshot as the customer-facing accepted document

Downstream work orders and invoices should consume the accepted estimate source loader instead of recomputing quote ownership.
```

- [ ] **Step 3: Commit**

```bash
git add docs/jobs-architecture.md docs/quote-estimate-architecture.md
git commit -m "docs: document accepted estimate ownership"
```

---

### Task 9: Final Verification

**Files:**
- No file changes.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm.cmd run test:node
npm.cmd run test:components -- app/api/__tests__/EstimatePublicPortalWorkflow.test.tsx app/api/__tests__/QuotePublicRoute.test.tsx app/api/__tests__/EstimatePublicRoute.test.tsx app/quote/[token]/__tests__/QuotePortalClient.test.tsx lib/customer-estimates/__tests__/PublicEstimatePortal.test.tsx
```

Expected:
- `npm.cmd run test:node` passes.
- Focused component/route tests pass.
- jsdom may print `HTMLCanvasElement.getContext()` warnings for drawn signature tests; those warnings are acceptable if the tests pass.

- [ ] **Step 2: Run full checks if time allows**

Run:

```bash
npm.cmd run check:full
```

Expected: lint, typecheck, build, and all tests pass.

- [ ] **Step 3: Commit any final fixes**

```bash
git add .
git commit -m "test: verify accepted estimate ownership workflow"
```

---

## Self-Review

- Spec coverage: The plan covers accepted public estimate side effects, canonical job linking, accepted source read model, and documentation for future work orders/invoices.
- Scope control: This does not build work orders, invoices, or note-photo parsing. Those should be separate plans after this ownership layer is merged.
- Risk: The only product decision baked in is setting accepted jobs to `scheduled`. If the desired status is `estimate_sent`, `follow_up`, or a new `won` status, change `buildAcceptedEstimateUpdatePlan` before implementation.
