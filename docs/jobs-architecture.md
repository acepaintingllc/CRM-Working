# Jobs Architecture

## Status Flow
- Canonical job statuses live in `lib/jobs/types.ts`.
- UI workflow actions and server-side implied transitions both derive from that jobs workflow definition.
- Reads must not mutate state. `GET /api/jobs/[id]` only returns persisted and derived values.

## Ownership
- Jobs API routes under `app/api/jobs/**` are thin adapters only:
  - auth via `requireSessionUserOrg`
  - param/body parsing
  - `serviceResultResponse` envelope mapping
- `lib/jobs/service.ts` owns jobs CRUD normalization, persistence, enrichment, and canonical route-contract data shaping.
- `lib/server/jobScheduleSync.ts` owns persisted schedule summary/status side effects for schedule creation, deletion, and stage-email schedule/review effects.
- `lib/jobs/client.ts` is the canonical client boundary for jobs CRUD-style reads/writes and direct endpoint helpers.
- `lib/jobs/actions.ts` is reserved for aggregate workflow helpers such as detail aggregation, stage email composition/send flows, and closeout aggregation.
- `app/crm/jobs/page.tsx`, `app/crm/jobs/new/page.tsx`, and `app/crm/jobs/[id]/page.tsx` are page composition shells. Their controller hooks under `app/crm/jobs/_hooks/**` own page-level orchestration.
- Presentational detail UI lives in `app/crm/jobs/[id]/_components/**`.
- Modal shells stay in `app/crm/jobs/_components`, while `useEmailComposer` and `useCloseoutForm` own their internal state and request logic.

## Adding or Changing Workflow Stages
- Add the canonical status/stage definition in `lib/jobs/types.ts` first.
- Update workflow action metadata there so board and detail surfaces render from the same config.
- If the stage affects persisted schedule summary or status side effects, route it through `lib/server/jobScheduleSync.ts` rather than patching job fields inline.
- If the UI needs new client fetch/mutation behavior, add it in `lib/jobs/actions.ts` and keep pages/components thin.

## Route Contract
- `GET /api/jobs` returns `{ data: JobSummary[] }`
- `POST /api/jobs` returns `{ data: JobSummary, notice? }`
- `GET /api/jobs/[id]` returns `{ data: JobDetail }`
- `PATCH /api/jobs/[id]` returns `{ data: Partial<JobDetail>, notice? }`
- `DELETE /api/jobs/[id]` returns `{ data: { ok: true }, notice? }`
- Route handlers should not return bespoke `jobs`, `job`, or `ok` payloads for the jobs CRUD surface.
