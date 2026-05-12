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
- `lib/server/jobScheduleWorkflow.ts` owns schedule CRUD workflow, Google Calendar side effects, and schedule summary/status sync for schedule routes.
- `lib/server/jobScheduleSync.ts` owns the shared persisted schedule summary/status sync helper used by schedule workflows and stage-email schedule/review effects.
- `lib/jobs/client.ts` is the canonical client boundary for jobs CRUD-style reads/writes and direct endpoint helpers.
- `lib/jobs/actions.ts` is reserved for aggregate workflow helpers such as detail aggregation, stage email composition/send flows, and closeout aggregation.
- `jobs.linked_estimate_id` is the canonical accepted estimate link for operational work after a quote is accepted.
- Public quote acceptance is the normal writer of `jobs.linked_estimate_id`.
- Job detail may fall back to linked estimate rows only for legacy data where `jobs.linked_estimate_id` is null.
- Work orders and invoices must read accepted estimate source data through `lib/server/accepted-estimates/service.ts`, not by picking the first estimate for a job.
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
- `GET /api/jobs/[id]/estimate-file` returns `{ data: EstimateDriveFile }` for the latest matching file
- `GET /api/jobs/[id]/estimate-file?all=1` returns `{ data: { latest: EstimateDriveFile | null, files: EstimateDriveFile[] } }`
- `GET /api/jobs/[id]/estimate-file?redirect=1` is the documented legacy browser-navigation exception:
  - intended for direct navigation callers that need the browser redirected to the Drive `webViewLink`
  - on success it returns an HTTP redirect instead of a `{ data }` envelope
  - service/client data reads must use the normal envelope endpoints and shared jobs route helpers, not redirect navigation
- `GET /api/jobs/[id]/work-order` returns `{ data: { current: JobWorkOrderRow | null } }`
- `POST /api/jobs/[id]/work-order/generate` returns `{ data: JobWorkOrderRow, notice? }`
- `POST /api/jobs/[id]/work-order/lock` returns `{ data: JobWorkOrderRow, notice? }`
- `POST /api/jobs/[id]/work-order/void` returns `{ data: JobWorkOrderRow, notice? }`
- `GET /api/jobs/[id]/invoice` returns `{ data: { current: JobInvoiceRow | null } }`
- `POST /api/jobs/[id]/invoice/generate` returns `{ data: JobInvoiceRow, notice? }`
- `PATCH /api/jobs/[id]/invoice` returns `{ data: JobInvoiceRow, notice? }`
- `POST /api/jobs/[id]/invoice/send` returns `{ data: JobInvoiceRow, notice? }`
- `POST /api/jobs/[id]/invoice/void` returns `{ data: JobInvoiceRow, notice? }`
- Route handlers should not return bespoke `jobs`, `job`, or `ok` payloads for the jobs CRUD surface.
