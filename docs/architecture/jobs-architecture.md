# Jobs Architecture

## Purpose

Defines ownership for jobs CRUD, workflow statuses/stages, schedule synchronization, and workflow/email side effects.

## Canonical Owners

| Concern | Owner |
| --- | --- |
| Job statuses, stage definitions, workflow action metadata | `lib/jobs/types.ts` |
| Jobs CRUD normalization, persistence, enrichment, route-contract shaping | `lib/jobs/service.ts` |
| Jobs API client boundary and endpoint helpers | `lib/jobs/client.ts` |
| Aggregate workflow helpers, detail aggregation, stage email composition/send, closeout aggregation | `lib/jobs/actions.ts` |
| Persisted schedule summary/status side effects | `lib/server/jobScheduleSync.ts` |
| Accepted estimate source data for work orders/invoices | `lib/server/accepted-estimates/service.ts` |
| Jobs API adapters | `app/api/jobs/**` |
| Jobs page orchestration | `app/crm/jobs/_hooks/**` |
| Jobs page shells | `app/crm/jobs/page.tsx`, `app/crm/jobs/new/page.tsx`, `app/crm/jobs/[id]/page.tsx` |
| Jobs detail presentation | `app/crm/jobs/[id]/_components/**` |
| Shared modal shells | `app/crm/jobs/_components` |

## Workflow Rules

- Canonical job statuses live in `lib/jobs/types.ts`.
- UI workflow actions and server-side implied transitions must derive from the same workflow definition.
- Reads must not mutate state. `GET /api/jobs/[id]` only returns persisted and derived values.
- Add or change statuses/stages in `lib/jobs/types.ts` first.
- Update workflow action metadata with the status/stage change so board and detail surfaces stay aligned.
- Put aggregate workflow behavior in `lib/jobs/actions.ts`, not in page components.

## Schedule And Side Effects

| Change | Required owner |
| --- | --- |
| Schedule create/delete changes persisted job summary/status | `lib/server/jobScheduleSync.ts` |
| Stage-email schedule/review effects | `lib/server/jobScheduleSync.ts` |
| Stage transition changes workflow metadata | `lib/jobs/types.ts` |
| Stage transition sends/composes email | `lib/jobs/actions.ts` |
| Closeout aggregation | `lib/jobs/actions.ts` |

Do not patch schedule summary, job status, or workflow-email side effects inline in routes, pages, or components.

## Linked Estimates

- `jobs.linked_estimate_id` is the canonical accepted estimate link for operational work after quote acceptance.
- Public quote acceptance is the normal writer of `jobs.linked_estimate_id`.
- Job detail may fall back to linked estimate rows only for legacy data where `jobs.linked_estimate_id` is null.
- Work orders and invoices must read accepted estimate source data through `lib/server/accepted-estimates/service.ts`.
- Do not pick the first estimate for a job as an accepted estimate.

## API Route Contract

| Route | Envelope |
| --- | --- |
| `GET /api/jobs` | `{ data: JobSummary[] }` |
| `POST /api/jobs` | `{ data: JobSummary, notice? }` |
| `GET /api/jobs/[id]` | `{ data: JobDetail }` |
| `PATCH /api/jobs/[id]` | `{ data: Partial<JobDetail>, notice? }` |
| `DELETE /api/jobs/[id]` | `{ data: { ok: true }, notice? }` |

Jobs route handlers stay thin: auth with `requireSessionUserOrg`, parse params/body, call the canonical service/action, and map with the standard envelope.

## UI Rules

- Jobs pages are composition shells; controller hooks own page-level orchestration.
- Presentational detail UI belongs under `app/crm/jobs/[id]/_components/**`.
- Modal shells stay in `app/crm/jobs/_components`.
- `useEmailComposer` and `useCloseoutForm` own their internal state and request logic.
- Follow `docs/architecture/crm-ui-system.md` for CRM page framing.

## Anti-Patterns

- Mutating job state during reads.
- Defining a status/stage in UI only.
- Updating persisted schedule summary/status outside `jobScheduleSync`.
- Sending or composing workflow email directly from components.
- Returning bespoke jobs CRUD payloads such as `{ job }`, `{ jobs }`, or bare `{ ok }`.
- Reading accepted estimate data by guessing from job estimates.
