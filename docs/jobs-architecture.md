# Jobs Architecture

## Status Flow
- Canonical job statuses live in `lib/jobs/types.ts`.
- UI workflow actions and server-side implied transitions both derive from that jobs workflow definition.
- Reads must not mutate state. `GET /api/jobs/[id]` only returns persisted and derived values.

## Ownership
- Jobs API routes under `app/api/jobs/**` own persistence and request validation.
- `lib/server/jobScheduleSync.ts` owns persisted schedule summary/status side effects for schedule creation, deletion, and stage-email schedule/review effects.
- `lib/jobs/actions.ts` is the client boundary for jobs UI fetches, mutations, normalization, and response parsing.
- `app/crm/jobs/[id]/page.tsx` is the detail coordinator. Presentational detail UI lives in `app/crm/jobs/[id]/_components/**`.
- Modal shells stay in `app/crm/jobs/_components`, while `useEmailComposer` and `useCloseoutForm` own their internal state and request logic.

## Adding or Changing Workflow Stages
- Add the canonical status/stage definition in `lib/jobs/types.ts` first.
- Update workflow action metadata there so board and detail surfaces render from the same config.
- If the stage affects persisted schedule summary or status side effects, route it through `lib/server/jobScheduleSync.ts` rather than patching job fields inline.
- If the UI needs new client fetch/mutation behavior, add it in `lib/jobs/actions.ts` and keep pages/components thin.
