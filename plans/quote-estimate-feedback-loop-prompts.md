# Quote Estimate Feedback Loop Implementation Prompts

These prompts are written for this repository after reviewing the current quotes/estimates system.

Current architecture facts to preserve:

- `Estimate` is the canonical internal domain term. `Quote` is user-facing route/copy only.
- `app/crm/quotes/[id]` remains a thin alias over canonical Estimator V2 routes in `app/crm/estimates/[id]/v2`.
- Accepted quote ownership flows through `lib/server/estimatePublicPortal.ts` and `lib/server/accepted-estimates/service.ts`.
- Jobs link to the accepted estimate through `jobs.linked_estimate_id`.
- Historical estimator settings now have first-class storage in `estimator_setting_set` and `estimator_setting_value`, with `estimates.setting_set_id_used` as the canonical estimate-level setting identity.
- `estimate_template_settings`, `estimator_template_constants`, and `estimator_template_constant_rows` remain only active-admin or migration compatibility surfaces.
- Immutable accepted-estimate operational truth now lives in `estimate_snapshot` and `estimate_snapshot_line`; public quote versions remain customer-facing document snapshots.
- `job_actuals`, `job_review`, `job_review_metric`, trends v1, recommendations, recommendation apply, and the insights UI exist in the working tree. Data-quality hardening and later line-level/analytics optimization work are still pending.

## Prompt 0 Discovery Result - Refreshed 2026-05-03

This section is the current implementation map after inspecting the required architecture docs, accepted-estimate flow, Estimator V2 load/calculation code, customer-send assembly, Rates/Flags settings code, feedback-loop services/UI, and migrations through `supabase/sql/083_trend_recommendations.sql`.

### Current Status Before Prompt 16

Prompts 11 through 15 are implemented in the working tree:

- Trends API: `lib/server/estimate-feedback/trends.ts` and `app/api/insights/trends/route.ts`.
- Trends and insights UI: `app/crm/insights/page.tsx`, `InsightsPageContent.tsx`, and `_hooks/*`.
- Recommendation generation/apply: `supabase/sql/083_trend_recommendations.sql`, `lib/server/estimate-feedback/recommendations.ts`, `app/api/insights/recommendations/route.ts`, and `app/api/insights/recommendations/[id]/apply/route.ts`.
- Client helpers: `lib/estimate-feedback/client.ts` now covers actuals, review, trends, recommendations, apply, and dismiss.

Prompt 16, Data Quality Hardening, is the next implementation step.

The trend source rows are locked, valid, non-excluded `job_review` records. Time filtering is SQL-level on `job_review.locked_at`. Job type, occupancy, and condition filters are v1 service-layer filters that inspect snapshot fields/text rather than normalized analytics dimensions; the occupancy and condition filters remain heuristic and should not be treated as finalized taxonomy controls.

### Decisions

- Active setting set ownership belongs in `lib/server/estimate-feedback/settingSets.ts`, backed by `estimator_setting_set`, `estimator_setting_value`, and `setting_change_log`. It owns active/draft/retired state, clone/update/activate behavior, historical estimate lookup, and scalar/default row mapping.
- `estimates.setting_set_id_used` is the canonical historical setting identity for an estimate version. Migration `078_create_estimate_version_setting_set.sql` assigns the current active set at version creation; migration `077_estimator_setting_sets.sql` backfills existing estimates to the active set as a compatibility default.
- Accepted-estimate snapshot creation belongs in accepted-estimate side effects, after ownership is established. Current code calls `ensureAcceptedEstimateOperationalSnapshot` from both first acceptance and accepted-retry reconciliation in `lib/server/estimatePublicPortal.ts`.
- Operational downstream data should read `estimate_snapshot` first. `lib/server/accepted-estimates/service.ts` already prefers snapshots and falls back to accepted public version snapshot plus rollup only when no operational snapshot exists.
- Actuals and review are job-level v1 domains under `lib/server/estimate-feedback`; line-level actuals are intentionally later.
- Trends and recommendations use locked valid non-excluded `job_review` records, not mutable estimate tables or draft actuals.
- Recommendation apply belongs in `lib/server/estimate-feedback/recommendations.ts`; it clones the active setting set, updates the targeted value, activates the clone, writes change-log context, and marks the recommendation applied or stale. It must never mutate `estimate_template_settings` or the old constants tables.

### Historical Settings Status

The original live-settings risk has been addressed in the current working tree:

- `lib/server/estimateCatalogs.ts` no longer discards `estimateId`.
- `getEstimateCatalogs(...)` resolves catalogs from `settingSetId`, then `estimateId` via `loadEstimateSettingSet`, then the active setting set.
- `buildV2CatalogResultFromSources` preserves the existing catalog response shape while building overlays from `estimator_setting_value` rows.
- `forceRefresh` is currently ignored; `adminRefreshMode: 'active'` is the explicit active-admin escape hatch and must not be used by historical estimate routes.

Remaining risk:

- `loadEstimateSettingSet` falls back to the active setting set when an estimate has no `setting_set_id_used`. That is acceptable only as a documented legacy fallback. Do not add new estimate paths that depend on active fallback for normal estimates.
- `estimate_catalog_snapshots` still exists through `lib/server/estimateRatesFlagsSnapshots.ts`, but current `getEstimateCatalogs` does not use it as a fallback. Treat it as an old compatibility surface unless a future migration explicitly repurposes it.
- Quote Defaults and Measurement Assumptions now read/write active scalar defaults through setting-set clone/update/activate. They still mirror to `estimate_template_settings` as a temporary compatibility surface, but that table is no longer the canonical write target.

### Compatibility Matrix

| Consumer | Current source | Category | Implementation direction |
|---|---|---:|---|
| `/api/estimates/[id]` and `/api/quotes/[id]` GET | `loadEstimateV2Response` plus setting-set-aware `loadEstimateTemplateSettings` and `getEstimateCatalogs` | `historical` | Keep response shape; continue resolving defaults/catalogs through `estimates.setting_set_id_used`. |
| `/api/estimates/[id]` and `/api/quotes/[id]` PUT/autosave calculations | `createCalculationCatalogsLoader` to `loadEstimateV2CalculationCatalogs` | `historical` | Save-time calculations already flow through estimate-specific catalogs; preserve this for every new calculation path. |
| `/api/estimates/[id]/catalogs` and `/api/quotes/[id]/catalogs` | `getEstimateCatalogs({ estimateId })` | `historical` | Return the estimate's historical catalog. Only explicit admin routes may request active catalogs. |
| Estimator V2 editor, details, summary | canonical estimate route payloads and calculation artifacts | `historical` | No route-alias duplication; calculations use the estimate setting set. |
| Customer-send context | `loadEstimateTemplateSettings({ estimateId })` and `getEstimateCatalogs({ estimateId })` | `historical` before accept, `snapshot` after accept | Send assembly uses the estimate setting set; accepted operations prefer `estimate_snapshot`. |
| Public quote portal load | `estimate_public_versions.snapshot_json` | `snapshot` | Continue serving the customer document snapshot; do not recompute from current settings. |
| Public quote acceptance | public version update, ownership side effects, operational snapshot ensure | `snapshot` | Keep snapshot ensure after accepted ownership. Document non-atomic acceptance/snapshot limitation. |
| Accepted estimate source loader | `jobs.linked_estimate_id`, accepted public version, `estimate_snapshot` | `snapshot` with compatibility fallback | Prefer `estimate_snapshot`; keep fallback for accepted legacy data without snapshot. |
| Quote Home rollups/version lists | persisted collection rows and `estimate_version_rollups` | `compatibility` | Reads can stay as persisted rollups; any repair/recalculation must use the estimate setting set. |
| Rates/Flags admin page | `estimator_setting_set` draft/active values | `active` | Current canonical path is setting sets; old constants tables are test/compatibility mirrors only. |
| Quote Defaults page | active `estimator_setting_set` scalar defaults, mirrored to `estimate_template_settings` | `active` with compatibility mirror | Keep setting-set clone/update/activate as canonical; remove old-table mirror after legacy consumers are gone. |
| Measurement Assumptions settings | active `estimator_setting_set` scalar defaults, mirrored to `estimate_template_settings` | `active` with compatibility mirror | Same as Quote Defaults. |
| Product reference checks | `estimate_template_settings`, estimate rows, `estimator_setting_value` | `compatibility` | Keep old scan but include setting values so active/historical references block unsafe archive/delete. |
| Estimate creation RPC | active `estimator_setting_set` plus `estimate_template_settings` fallback | `active` | Continue writing `setting_set_id_used`; remove old-table fallback only after defaults pages write setting sets. |
| Estimate seed route | `loadEstimateTemplateSettings` | `active` for new seed, `historical` for existing estimate | Existing estimates must use their setting set; new unbound seeds may use active defaults. |
| Job actuals API/UI | `estimate_snapshot` and `job_actuals` | `snapshot` | Actuals must reference a snapshot belonging to the same org/job. |
| Job review API | `estimate_snapshot`, submitted/locked `job_actuals`, `job_review_metric` | `snapshot` | Metrics recompute until review is locked; locked review is trend source. |
| Trends v1 | locked valid non-excluded reviews | `snapshot` | Query `job_review.trend_eligible` and metrics, never live estimate settings. Time filtering is SQL-level on `job_review.locked_at`; job type, occupancy, and condition filters are currently service-layer snapshot/text filters. |
| Recommendations generation | locked valid non-excluded reviews plus active setting-set target keys | `snapshot` | Generate from trend service outputs and store `trend_recommendation` rows; do not read mutable estimate settings as evidence. |
| Recommendation apply | open `trend_recommendation` plus active `estimator_setting_set` values | `active` | Clone/update/activate setting sets only; old estimates and snapshots keep `setting_set_id_used`/`estimate_snapshot`. |
| Insights UI | trends API plus open recommendation API | `snapshot` for trend evidence, `active` for apply | Components render VM output only; actions call `lib/estimate-feedback/client.ts`. |

### Current Direct Old-Table Reads And Writes

`estimate_template_settings`:

- `lib/server/estimateTemplateSettings.ts`: compatibility fallback read only when no setting set is available or when called with the legacy string signature.
- `lib/server/settings/quoteDefaultsStore.ts`: compatibility fallback read and best-effort mirror write only; canonical reads/writes use active setting-set scalar defaults.
- `lib/server/settings/quoteMeasurementAssumptionsStore.ts`: compatibility fallback read and best-effort mirror write only; canonical reads/writes use active setting-set scalar defaults.
- `lib/server/estimate-products/repository.ts`: compatibility read for product reference checks.
- `supabase/sql/059_atomic_estimate_version_creation.sql`: old replaced function body; kept as historical migration.
- `supabase/sql/078_create_estimate_version_setting_set.sql`: still reads `estimate_template_settings` as fallback while seeding `estimate_jobsettings` and pricing policy rows.
- Schema/backfill migrations: `054`, `055`, `056`, `057_crm_settings_domain`, `069_estimate_deduction_settings`, `077`, and `078`.
- Tests/mock surfaces: `lib/server/customer-send/__tests__/contextLoader.test.tsx`, `lib/server/estimate-products/__tests__/repository.test.ts`, and route/load tests that mock `loadEstimateTemplateSettings`.

`estimator_template_constants`:

- `lib/server/rates-flags/templateState.ts`: compatibility read/insert/update helpers (`fetchTemplateState`, `ensureTemplateState`, `bumpTemplateVersion`).
- `lib/server/rates-flags/core.ts`: imports template compatibility helpers only through `_test`; production reads/writes now use setting sets.
- Schema/seeding/backfill migrations: `043`, `045`, `049`, `057_estimator_template_constant_rows_trim_production_seed`, both `063` constants/trim migrations, both `065` constants/condition migrations, `067`, `072`, and `077`.
- Historical design docs only: `docs/superpowers/**` references old constants tables but is not a runtime consumer.
- Tests: `lib/server/__tests__/estimateRatesFlags.test.ts` and migration tests.

`estimator_template_constant_rows`:

- `lib/server/rates-flags/templateState.ts`: compatibility row reads through `fetchTemplateState` and `getTemplateRowById`.
- `lib/server/estimateRatesFlagsSnapshots.ts`: reads the active setting-set overlay through `readLiveRatesFlagsCatalogOverlay` and writes old `estimate_catalog_snapshots`; despite the name, it no longer directly reads old rows.
- Schema/seeding/backfill migrations: `043`, `044`, `045`, `049`, `057_estimator_template_constant_rows_trim_production_seed`, both `063` constants/trim migrations, `064_add_crew_multiplier_to_supply_rates`, both `065` constants/condition migrations, `067`, `072`, and `077`.
- Historical design docs only: `docs/superpowers/**` references old constants tables but is not a runtime consumer.
- Tests: `lib/server/__tests__/estimateRatesFlags.test.ts`, catalog/snapshot tests, and migration tests.

### File-By-File Implementation Map

#### DB

- `supabase/sql/077_estimator_setting_sets.sql`: exists. Creates `estimator_setting_set`, `estimator_setting_value`, `setting_change_log`, adds/backfills `estimates.setting_set_id_used`, seeds active setting-set values from old tables, and adds RLS/indexes.
- `supabase/sql/078_create_estimate_version_setting_set.sql`: exists. Replaces `create_estimate_version`, assigns active `setting_set_id_used`, and seeds jobsettings/pricing from setting-set scalar values with old-table fallback.
- `supabase/sql/079_estimate_snapshot_tables.sql`: exists. Creates immutable `estimate_snapshot` and `estimate_snapshot_line`.
- `supabase/sql/080_estimate_feedback_atomic_rpcs.sql`: exists. Adds `insert_estimate_snapshot_with_lines` and `activate_estimator_setting_set`.
- `supabase/sql/081_job_actuals.sql`: exists. Adds job-level actuals scoped to immutable snapshots.
- `supabase/sql/082_job_review.sql`: exists. Adds review and metric tables plus generated `trend_eligible`.
- `supabase/sql/083_trend_recommendations.sql`: exists. Adds `trend_recommendation`, open recommendation uniqueness, status indexes, RLS, and the nullable `setting_change_log.recommendation_id` foreign key.
- Next DB work: add only data-quality hardening/outlier support that is justified by Prompt 16; add trend query indexes only after observing query shape; add no analytics summary table yet.

#### Server Services

- `lib/server/estimate-feedback/settingSets.ts`: exists and is canonical for setting-set reads, draft clone/update, activation, change log, and old-shape adapters. Quote Defaults and Measurement Assumptions now use its scalar-default path.
- `lib/server/estimateCatalogs.ts`: exists and is source-aware. Keep `EstimateCatalogsResult` stable; do not route estimate-specific reads through `adminRefreshMode: 'active'`.
- `lib/server/estimateTemplateSettings.ts`: exists as a compatibility wrapper around setting-set scalar values. Keep it until calculation/customer-send callers can consume setting-set DTOs directly.
- `lib/server/rates-flags/core.ts`: production Rates/Flags reads/mutations use setting-set active/draft flows. Keep `templateState.ts` only as compatibility/test support unless a deliberate mirror sync is added.
- `lib/server/estimate-v2/loadEstimateAssembly.ts` and `calculationOrchestration.ts`: already pass estimate IDs into defaults/catalog loaders. Guard future calculations to use `createCalculationCatalogsLoader` or equivalent estimate-specific loaders.
- `lib/server/customer-send/contextRepository.ts` and `contextCalculations.ts`: already load settings/catalogs by estimate ID. Preserve public version snapshot behavior.
- `lib/server/accepted-estimates/service.ts`: already prefers `estimate_snapshot` and exposes `ensureAcceptedEstimateOperationalSnapshot`.
- `lib/server/estimatePublicPortal.ts`: already calls snapshot ensure after accepted ownership on first accept and retry. Remaining concern is documenting or tightening atomicity if needed.
- `lib/server/estimate-feedback/snapshots.ts`: exists. Builds immutable snapshots from canonical Estimator V2 load/calculation path and inserts through RPC.
- `lib/server/estimate-feedback/actuals.ts`: exists. Owns actuals validation, save, submit, lock.
- `lib/server/estimate-feedback/reviews.ts`: exists. Owns review validation, metric computation, save, lock, and trend eligibility.
- `lib/server/estimate-feedback/trends.ts`: exists. Owns trend source selection, SQL-level `locked_at` time filtering, metric aggregation, and v1 service-layer snapshot/text filters for job type, occupancy, and condition tags.
- `lib/server/estimate-feedback/recommendations.ts`: exists. Owns recommendation target parsing, rule-based generation, duplicate-open prevention, dismiss/apply status changes, stale apply conflict detection, setting-set clone/update/activate, and recommendation change-log context.

#### API Routes

- Existing estimate/quote routes keep standard envelopes and auth. Their service layer must keep resolving historical settings by estimate ID.
- `app/api/quotes/rates-flags/route.ts` should continue exposing active/draft setting metadata and activation actions through the existing client path.
- `app/api/settings/quote-defaults/route.ts` and `app/api/settings/quote-measurement-assumptions/route.ts` should be migrated to setting-set scalar draft/activate behavior.
- Job actuals routes exist under `app/api/jobs/[id]/actuals/**`.
- Job review routes exist under `app/api/jobs/[id]/review/**`.
- `app/api/insights/trends/route.ts` exists and is the Prompt 11 trends API.
- `app/api/insights/recommendations/route.ts` exists for listing, generating, and status updates.
- `app/api/insights/recommendations/[id]/apply/route.ts` exists for setting-set apply. It authenticates first, parses UUID params, and returns standard envelopes.

#### Types And Client Helpers

- `types/estimator/ratesFlags.ts` remains the Rates/Flags category config and draft shape source.
- `lib/estimate-feedback/client.ts` exists for job actuals, review, trends, recommendations, apply, and dismiss actions.
- Needed: shared type files under `types/estimate-feedback/*` if trend/recommendation DTOs become broader than route-local read models.

#### UI

- Existing Estimator V2 and send pages need no visual redesign for setting-set reads.
- `app/crm/jobs/[id]/actuals` exists and should stay on shared CRM UI primitives.
- `app/crm/jobs/[id]/review` exists with route-local hook/controller/VM and shared CRM UI.
- `app/crm/insights` exists for trends, URL-backed filters, and open recommendation cards. Treat occupancy and condition filters as optional heuristic filters, not finalized taxonomy controls.

#### Tests

- Existing/new test coverage includes setting-set migration/domain, catalog historical behavior, snapshot migration/service, actuals migration/service/routes/UI VM/controller, and review migration/service/routes.
- Quote Defaults and Measurement Assumptions store tests now cover setting-set scalar writes, activation source, validation-before-mutation, and compatibility mirroring.
- Trend tests exist for locked valid non-excluded review selection and filters; keep expanding them during Prompt 16 for outlier/data-quality hardening.
- Recommendation tests exist for generation/apply behavior; Prompt 16 should add explicit invalid/questionable/excluded poisoning guards across trends and recommendations.

Mandatory compatibility guardrail:

- Settings versioning is complete only when every existing reader/writer of estimator settings is either routed through the setting-set resolver or explicitly documented as a compatibility fallback.
- The remaining old-table writes in Quote Defaults and Measurement Assumptions are best-effort compatibility mirrors only. Do not build new behavior on top of those mirrors.

Recommended canonical module family:

- Shared server domain: `lib/server/estimate-feedback/*`
- Shared client/domain helpers: `lib/estimate-feedback/*`
- Shared types when needed: `types/estimate-feedback/*`
- Job-level actual/review routes: `app/api/jobs/[id]/actuals/**` and `app/api/jobs/[id]/review/**`
- Portfolio trends/recommendations routes: `app/api/insights/trends/**` and `app/api/insights/recommendations/**`
- Job-level UI: `app/crm/jobs/[id]/actuals` and `app/crm/jobs/[id]/review`
- Portfolio UI: `app/crm/insights`

How to use these prompts in fresh chats:

- Start each new chat by pasting the exact prompt for the next phase.
- Each prompt now includes a `Fresh-chat context` section that tells the next agent what should already exist and what to verify before coding.
- If a prerequisite is missing, the agent should either implement the missing prerequisite first when it is small and directly required, or stop and report the missing prerequisite instead of inventing a parallel path.
- Treat Prompt 0 as the orientation prompt. It can be rerun any time the repo has drifted or when a later prompt exposes ambiguity.
- Keep the generated implementation artifacts in the repo so the next fresh chat can discover them from files and tests, not from prior conversation memory.

## Prompt 0: Architecture Discovery And Contract Lock

```text
Read `ARCHITECTURE.md`, `docs/app-architecture-standards.md`, `docs/crm-ui-system.md`, `docs/quote-estimate-architecture.md`, `docs/quotes-system.md`, `docs/quotes-architecture.md`, and `docs/jobs-architecture.md`.

Fresh-chat context:
This is the orientation prompt for the full estimate feedback loop. No prior prompt output is required, but if `plans/quote-estimate-feedback-loop-prompts.md` already exists, read it first and update any stale assumptions instead of creating a second plan.

Task: discovery / implementation plan
Scope: quote/estimate settings, accepted estimate ownership, Estimator V2 calculations, customer-send snapshots, and jobs workflow.
Goal: produce a concrete implementation map for the estimate feedback loop before coding.

Inspect:
- `lib/server/estimatePublicPortal.ts`
- `lib/server/accepted-estimates/service.ts`
- `lib/server/estimateCatalogs.ts`
- `lib/server/estimateRatesFlags.ts`
- `lib/server/estimateRatesFlagsSnapshots.ts`
- `lib/server/estimate-v2/loadEstimateAssembly.ts`
- `lib/server/estimate-v2/calculationOrchestration.ts`
- `lib/server/customer-send/*`
- current migrations under `supabase/sql`

Decide and document:
- where active setting set ownership belongs
- where accepted-estimate snapshot creation should be triggered
- how existing mutable settings migrate into immutable `estimator_setting_set` / `estimator_setting_value`
- which current tables stay as compatibility surfaces
- which routes/pages should be created for actuals, review, trends, and recommendations
- a compatibility matrix for every existing settings consumer using the categories `historical`, `active`, `snapshot`, or `compatibility`

Success criteria:
- no code changes yet
- produce a file-by-file plan with DB, API, service, type, UI, and test impact
- call out current `getEstimateCatalogs` live-settings behavior and how the implementation will stop future setting changes from rewriting estimate history
- identify every current direct read/write of `estimate_template_settings`, `estimator_template_constants`, and `estimator_template_constant_rows`

Out of scope:
- implementing migrations or UI
```

## Prompt 1: Settings Versioning Schema Foundation

```text
Read `docs/feature-page-prompt-template.md` and follow it.

Fresh-chat context:
This is the first implementation step. It builds on the architectural direction in `plans/quote-estimate-feedback-loop-prompts.md` and should create the DB foundation that later prompts depend on. Before coding, verify the latest migration number and check whether `estimator_setting_set`, `estimator_setting_value`, `setting_change_log`, or `estimates.setting_set_id_used` already exist from a previous run.

Implement:
Estimator settings versioning DB foundation.

User / job to be done:
Admins need future setting changes to affect only new estimates, while prior estimates and accepted snapshots remain historically accurate.

Feature scope:
- Add an additive SQL migration after the latest migration.
- Create `estimator_setting_set`, `estimator_setting_value`, and `setting_change_log`.
- Add `setting_set_id_used` to `estimates`.
- Backfill one active setting set per org from current `estimate_template_settings` plus current `estimator_template_constant_rows`.
- Backfill existing estimates to the active setting set only as a compatibility default.

Schema requirements:
- `estimator_setting_set`: org id, version number, status (`draft`, `active`, `retired`), source set id, created/activated/retired metadata, notes, timestamps.
- Enforce one active setting set per org with a partial unique index.
- `estimator_setting_value`: org id, setting set id, category key, row id or scalar key, display name, active flag, sort order, value json, timestamps.
- Enforce unique values per set/category/key.
- `setting_change_log`: org id, previous setting set id, new setting set id, target key, old value json, new value json, source, reason, actor id, recommendation id nullable, timestamp.
- Add RLS policies matching existing org membership patterns.

Success criteria:
- migration is idempotent
- every org with current estimator settings gets exactly one active setting set
- current rates/flags and scalar defaults are represented in `estimator_setting_value`
- new constraints prevent two active setting sets for the same org

Out of scope:
- changing the Rates/Flags UI
- changing calculations to read from setting sets
- creating snapshots, actuals, reviews, or recommendations

Definition of done:
- add focused migration tests or SQL-shape tests if this repo has a migration test pattern
- run the relevant node/server tests
```

## Prompt 2: Settings Set Server Domain And Catalog Read Path

```text
Read `docs/feature-page-prompt-template.md`, `docs/quote-estimate-architecture.md`, and `docs/quotes-architecture.md`.

Fresh-chat context:
This builds on Prompt 1. The setting-set tables and `estimates.setting_set_id_used` should already exist. If they do not, implement Prompt 1 first or stop and report that the schema prerequisite is missing. The main purpose here is to make the app actually use versioned settings, not just have versioned tables.

Implement:
Server-side setting set domain and catalog read integration.

Feature scope:
- Create `lib/server/estimate-feedback/settingSets.ts` or a more locally consistent module name.
- Add functions to load active setting set, load a setting set by id, clone active setting set as draft, update draft values, activate draft, and write `setting_change_log`.
- Update `lib/server/estimateCatalogs.ts` so catalog reads can resolve by `settingSetId`.
- Update estimate catalog/calculation loading so an estimate uses `estimates.setting_set_id_used` when present, and only falls back to the active set for legacy estimates without one.
- Keep existing Rates/Flags types and category configs as the parsing/shape source. Do not duplicate category definitions.
- Audit every direct read/write of `estimate_template_settings`, `estimator_template_constants`, and `estimator_template_constant_rows`; replace it with the setting-set resolver unless it is explicitly active-admin behavior or a documented compatibility fallback.
- Preserve current route response shapes while changing the source of values.

Consumer requirements:
- `/api/estimates/[id]` and `/api/quotes/[id]` must load catalogs/calculations through the estimate's stored setting set.
- `/api/estimates/[id]/catalogs` and `/api/quotes/[id]/catalogs` must return the historical catalog for the estimate unless a documented admin refresh mode is requested.
- Estimator V2 editor, summary, and details pages must keep their current payload shapes.
- Customer send/review document assembly must use the same historical setting set as the estimate, not whatever is currently active.
- Public quote acceptance must not recompute from active settings while creating operational snapshots.
- Quote home rollups must continue to read persisted rollups; if recalculation is triggered, it must use the estimate's setting set.
- Accepted estimate source loading must prefer immutable `estimate_snapshot` once it exists, while keeping the existing public-version snapshot for customer-facing document history.
- Quote Defaults and Measurement Assumptions stores must be classified as active-admin settings or compatibility surfaces; do not silently let them rewrite historical estimate behavior.
- Existing tests that mock old settings tables must be updated to prove historical-vs-active behavior instead of only proving fallback defaults.

Success criteria:
- `getEstimateCatalogs({ estimateId })` no longer ignores estimate-specific historical settings.
- existing catalog output shape stays compatible with Estimator V2.
- active set changes do not alter catalogs for estimates that already have `setting_set_id_used`.
- tests prove active-set read, historical-set read, legacy fallback, customer-send historical reads, and quote/estimate alias parity.
- implementation leaves no unclassified direct old-table settings reads/writes in app/server code.

Out of scope:
- Rates/Flags page clone/activate UI
- recommendation application
- snapshot tables

Definition of done:
- route handlers keep `{ data }` and `{ error }` envelopes
- no direct DB reads from components/hooks
- add unit tests around setting set read/mapping and `estimateCatalogs` behavior
```

## Prompt 3: New Estimate Creation Uses Active Setting Set

```text
Read `docs/feature-page-prompt-template.md`, `docs/quotes-architecture.md`, and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompts 1 and 2. The active setting-set resolver should already exist, and catalog reads should understand historical setting sets. This prompt makes newly created estimates capture the active setting set at creation time.

Implement:
Assign active estimator setting set to every newly created estimate version.

Feature scope:
- Update `public.create_estimate_version` RPC in a new additive migration to write `estimates.setting_set_id_used`.
- Update `lib/server/estimate-collection/versionService.ts` and repository tests if route/service assumptions change.
- Ensure seeded `estimate_jobsettings` still works, but the canonical version identity is the setting set id.
- Add service tests proving a new quote/estimate version stores the active set id.

Success criteria:
- new estimates use the active setting set at creation time
- later active setting changes do not change the estimate's catalog source
- quote create flow remains compatible with `/crm/quotes/create`

Out of scope:
- editing historical estimates to switch setting sets
- snapshot creation
```

## Prompt 4: Rates/Flags Clone-And-Activate Workflow

```text
Read `docs/quotes-system.md` and follow it.

Fresh-chat context:
This builds on Prompts 1 and 2. The setting-set schema and server domain should already exist. This prompt changes Rates/Flags admin editing so future setting edits create a new setting set instead of rewriting the active historical values in place.

Task: refactor / build
Scope:
- `lib/server/estimateRatesFlags.ts`
- `lib/server/rates-flags/*`
- `app/api/quotes/rates-flags/route.ts`
- `app/crm/quotes/_hooks/useQuoteRatesPage.ts`
- `app/crm/quotes/_hooks/quoteRatesPageController.ts`
- `app/crm/quotes/_hooks/quoteRatesPageMutations.ts`
- related Rates/Flags VM/tests

Goal:
Make Rates/Flags edits versioned: clone the active setting set, apply mutations to the draft set, then activate the set explicitly. Existing category configs and draft adapters remain canonical.

Behavior:
- one active setting set per org
- editing starts from a draft clone of active set
- saving values updates the draft set
- activating draft retires the previous active set, activates the draft, and logs changes
- old setting sets remain readable for historical estimates
- existing estimates with `setting_set_id_used` do not change when a Rates/Flags draft is activated

Success criteria:
- Rates/Flags payload includes active setting set metadata and draft metadata if present
- mutations do not directly rewrite active historical values
- activation writes `setting_change_log`
- tests cover clone, mutate draft, activate, historical set read, and unchanged catalogs for an older estimate

Out of scope:
- recommendation apply flow
- UI redesign beyond controls needed to manage draft/activate states
```

## Prompt 5: Estimate Snapshot Schema

```text
Read `ARCHITECTURE.md`, `docs/app-architecture-standards.md`, and `docs/quote-estimate-architecture.md`.

Fresh-chat context:
This builds on Prompt 1 because snapshots store `setting_set_id_used`. It can be implemented before the snapshot builder, but do not start actuals/reviews until these immutable snapshot tables exist.

Implement:
Immutable estimate snapshot tables.

Feature scope:
- Add SQL migration for `estimate_snapshot` and `estimate_snapshot_line`.
- Store snapshot-level totals, assumptions JSON, source calculation payload JSON, accepted public version id, and `setting_set_id_used`.
- Store line-level outputs for walls, ceilings, trim, doors, drywall, other, access, and policy/summary rows.
- Make snapshots immutable after insert with trigger guards against update/delete.

Required snapshot columns:
- org_id, job_id, estimate_id, customer_id
- accepted_public_version_id nullable
- setting_set_id_used nullable but populated when available
- snapshot_created_reason (`accepted`, `manual_sold`, or `backfill`)
- estimate_version_name/state/kind at snapshot time
- estimated_labor_hours
- estimated_paint_gallons
- estimated_primer_gallons
- estimated_paint_material_cost
- estimated_supplies_cost
- estimated_other_cost
- estimated_access_cost
- estimated_total
- assumptions_json
- totals_json
- source_payload_json
- created_at, created_by

Required line columns:
- snapshot_id, org_id, job_id, estimate_id
- line_key, line_kind, room_id, source_table, source_row_id
- label, position
- estimated_labor_hours
- estimated_paint_gallons
- estimated_primer_gallons
- estimated_material_cost
- estimated_supply_cost
- estimated_total
- assumptions_json
- output_json

Constraints:
- unique snapshot per `(org_id, estimate_id)` for v1
- unique line key per snapshot
- org-scoped indexes for job, estimate, accepted public version, and setting set
- RLS policies follow existing org membership pattern

Success criteria:
- migration is additive and idempotent
- immutability is enforced by DB triggers
- no live estimate table updates are needed to read a snapshot

Out of scope:
- snapshot builder service
- actuals/reviews/trends
```

## Prompt 6: Estimate Snapshot Builder And Accepted Flow Hook

```text
Read `docs/feature-page-prompt-template.md`, `docs/quote-estimate-architecture.md`, and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompts 2 and 5. Historical catalog loading must already use `estimates.setting_set_id_used`, and immutable snapshot tables must exist. This prompt connects accepted/sold estimate behavior to operational snapshot creation.

Implement:
Create an immutable estimate snapshot when an estimate is accepted/sold.

Feature scope:
- Create `lib/server/estimate-feedback/snapshots.ts`.
- Build snapshot data from the canonical Estimator V2 load/calculation path, not from quote route aliases.
- Hook snapshot creation into accepted estimate side effects so both first acceptance and acceptance retry/reconciliation paths create or reuse the snapshot.
- Update `lib/server/accepted-estimates/service.ts` and `lib/server/estimatePublicPortal.ts` carefully to avoid duplicate acceptance logic.

Builder requirements:
- load estimate, job, jobsettings, org defaults, rooms/scopes, calculations, pricing summary, and setting set id
- compute job-level estimated labor hours, paint gallons, primer gallons, supplies, other, access, and final total
- write `estimate_snapshot` and `estimate_snapshot_line` inside an idempotent service path
- if snapshot already exists for estimate, return it without mutation

Acceptance requirements:
- on successful public quote acceptance, create snapshot after accepted ownership is established
- retrying acceptance for an already accepted quote must ensure a snapshot exists
- snapshot creation failure should fail the acceptance only if the accepted side effect has not already committed; document the transaction limitation if the current service cannot make this fully atomic
- snapshot creation must use the estimate's stored setting set and persisted/customer-send document data, not the current active setting set

Success criteria:
- accepting a quote creates exactly one immutable snapshot
- later edits to live estimate tables do not change the snapshot
- tests cover first acceptance, acceptance retry, duplicate snapshot, and live-estimate mutation after snapshot
- tests cover activating a new setting set after acceptance and proving the snapshot remains unchanged

Out of scope:
- actuals/review UI
- replacing customer-facing public version snapshots
```

## Prompt 7: Job Actuals V1 Domain And API

```text
Read `docs/feature-page-prompt-template.md` and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompts 5 and 6. `estimate_snapshot` should exist and accepted estimates should create or expose a snapshot. If snapshots are not implemented yet, actuals will not have a stable estimate truth to reference.

Implement:
Job-level actuals v1.

Feature scope:
- Add `job_actuals` migration.
- Create `lib/server/estimate-feedback/actuals.ts`.
- Add authenticated route handlers under `app/api/jobs/[id]/actuals`.
- Add client helpers in `lib/estimate-feedback/client.ts`.

Fields:
- org_id, job_id, estimate_snapshot_id
- actual_labor_hours
- actual_paint_gallons
- actual_supplies_cost
- actual_other_cost
- notes
- status (`draft`, `submitted`, `locked`)
- submitted_at, locked_at, created_at, updated_at, created_by, updated_by

Rules:
- unique `(org_id, job_id, estimate_snapshot_id)`
- draft actuals can be saved repeatedly
- submitted/locked actuals cannot be overwritten through the draft save path
- locked actuals are immutable except through an explicit future admin unlock path, which is out of scope
- actuals must reference a snapshot that belongs to the same job/org

API:
- GET loads the actuals for a job and snapshot
- PUT upserts draft actuals
- POST `/submit` transitions draft to submitted
- POST `/lock` transitions submitted to locked

Success criteria:
- user can save draft actuals
- user can submit/lock actuals
- route handlers authenticate first and return standard envelopes
- tests cover duplicate prevention, wrong-org/job snapshot rejection, and locked immutability

Out of scope:
- line-level actuals
- review computation
- UI
```

## Prompt 8: Actuals Input Page

```text
Read `docs/feature-page-prompt-template.md`, `docs/crm-ui-system.md`, and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompt 7. The `job_actuals` API and immutable estimate snapshots should already exist. This prompt is UI/controller work only; keep persistence and validation in the actuals domain created earlier.

Implement:
Job actuals input page.

Feature scope:
- Add `app/crm/jobs/[id]/actuals/page.tsx`.
- Add route-local hook/controller/VM files under the jobs route, following existing jobs page patterns.
- Load the accepted estimate snapshot for the job, then load/save actuals.
- Render job-level fields for labor hours, paint gallons, supplies cost, other cost, notes, and status actions.
- Show estimate-vs-actual comparison values from the snapshot while editing actuals.

Success criteria:
- page works for a job with an accepted estimate snapshot
- user can save draft and submit
- no business math lives in components; use VM/domain helpers
- empty state appears when the job has no accepted estimate snapshot
- tests cover VM formatting and save/submit controller flows

Out of scope:
- review lock
- trend/recommendation cards
- scope-level actuals
```

## Prompt 9: Review Compute Schema, Domain, And API

```text
Read `docs/feature-page-prompt-template.md` and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompts 5 and 7. Immutable snapshots and submitted/locked job actuals should exist. This prompt creates the review comparison layer that trends will later treat as the approved source.

Implement:
Job review comparison layer.

Feature scope:
- Add `job_review` and `job_review_metric` migration.
- Create `lib/server/estimate-feedback/reviews.ts`.
- Add routes under `app/api/jobs/[id]/review`.
- Compute review metrics from immutable `estimate_snapshot` plus submitted/locked `job_actuals`.

Metrics:
- labor variance
- paint variance
- supplies variance
- other variance
- total impact
- variance percent
- within tolerance yes/no

Review fields:
- primary_cause_tag
- review_notes
- status (`draft`, `reviewed`, `locked`)
- exclude_from_trends
- data_quality_status (`valid`, `questionable`, `invalid`)
- change_order_present
- reviewed_at, locked_at, created/updated metadata

Rules:
- one review per `(org_id, job_id, estimate_snapshot_id)`
- metrics are recomputed while review is draft/reviewed
- locked review becomes immutable approved source for trends
- locked review requires submitted or locked actuals
- trend eligibility requires locked review, valid data quality, not excluded

Success criteria:
- one job can be reviewed from stable snapshot and actuals
- review output matches the needed Review UI cards
- tests cover variance math, tolerance, lock rules, and data quality exclusions

Out of scope:
- portfolio trend queries
- recommendations
- UI
```

## Prompt 10: Job Review UI

```text
Read `docs/feature-page-prompt-template.md`, `docs/crm-ui-system.md`, and `docs/jobs-architecture.md`.

Fresh-chat context:
This builds on Prompt 9. The review API, `job_review`, and `job_review_metric` should already exist. This prompt adds the job-level review screen and must not recompute domain metrics in React components.

Implement:
Job review page for estimate snapshot vs actuals.

Feature scope:
- Add `app/crm/jobs/[id]/review/page.tsx`.
- Use a route-local page hook, controller, and pure VM builder.
- Render KPI cards, variance breakdown, root cause fields, data quality controls, exclude-from-trends, and lock/review actions.
- Consume the review API from Prompt 9.

Success criteria:
- page loads a computed review for a job with submitted actuals
- user can set cause tag, notes, data quality, exclude flag, and lock review
- locked review state is read-only
- tests cover VM states and lock action behavior

Out of scope:
- recommendation generation
- trend dashboard
```

## Prompt 11: Trend Query Layer And API (Implemented)

```text
Read `docs/feature-page-prompt-template.md`.

Fresh-chat context:
This builds on Prompt 9. Locked reviews and review metrics should already exist. This prompt intentionally proves the trend loop with direct DB queries before adding recommendations or analytics summary tables.

Status note:
Implemented in the working tree with `lib/server/estimate-feedback/trends.ts` and `app/api/insights/trends/route.ts`. Trend source rows are locked, valid, non-excluded `job_review` records. The route authenticates before parsing or service work, returns standard `{ data }` / `{ error }` envelopes, and accepts query aliases `start/end`, `lockedFrom/lockedTo`, `job_type`, and repeated condition tag params. Time filtering is SQL-level on `job_review.locked_at`. Job type, occupancy, and condition tag filters are v1 service-layer snapshot fields/text filters because those values are not first-class normalized analytics dimensions yet; keep that caveat visible before treating all Prompt 11 filters as SQL-backed taxonomy controls.

Implement:
Simple trend queries from locked reviews.

Feature scope:
- Create `lib/server/estimate-feedback/trends.ts`.
- Add `app/api/insights/trends/route.ts`.
- Query only locked reviews with `data_quality_status = 'valid'` and `exclude_from_trends = false`.
- Support filters: time range, job type if available, occupied/vacant, condition tags.
- Do not create summary tables, materialized views, trend runs, or fact tables yet.

Metrics:
- average labor variance
- average paint variance
- average supplies variance
- average miss per job / portfolio impact
- count of jobs analyzed
- scope/category patterns if represented in `job_review_metric`

Success criteria:
- Trends endpoint loads real DB-backed numbers
- filters are applied in SQL/service layer, not in UI components
- tests cover filter behavior and exclusion rules

Out of scope:
- recommendation generation
- analytics materialization
- scope/room actuals
```

## Prompt 12: Trends And Insights Page (Implemented)

```text
Read `docs/feature-page-prompt-template.md` and `docs/crm-ui-system.md`.

Fresh-chat context:
This builds on Prompt 11. The trends API should already return real locked-review metrics. This prompt is the portfolio UI layer and should not introduce trend math outside the trend domain/VM helpers.

Status note:
Implemented in the working tree with `app/crm/insights/page.tsx`, `app/crm/insights/InsightsPageContent.tsx`, and `app/crm/insights/_hooks/*`. The UI treats occupancy and condition filters as optional heuristic filters from snapshot text/fields, not as finalized taxonomy controls.

Implement:
Portfolio trends and insights page.

Feature scope:
- Add `app/crm/insights/page.tsx`.
- Add hooks/controller/VM under `app/crm/insights/_hooks`.
- Load trend data from `/api/insights/trends`.
- Render filters, KPI cards, variance breakdown, observed patterns, and placeholders for recommendation cards.

Success criteria:
- page loads from real trend queries
- filters update URL/search params where useful
- empty, loading, and error states use shared CRM UI primitives
- no trend math in components
- tests cover VM formatting and client filter behavior

Out of scope:
- recommendation apply workflow
- materialized analytics
```

## Prompt 13: Rule-Based Recommendation Generation (Implemented)

```text
Read `docs/feature-page-prompt-template.md`.

Fresh-chat context:
This builds on Prompts 11 and 2. Trend queries should exist, and setting values must have stable target keys from the setting-set domain. This prompt generates recommendation records only; applying them is a separate later workflow.

Status note:
Implemented in the working tree with `supabase/sql/083_trend_recommendations.sql`, `lib/server/estimate-feedback/recommendations.ts`, and `app/api/insights/recommendations/route.ts`.

Implement:
Rule-based trend recommendations.

Feature scope:
- Add `trend_recommendation` migration.
- Create `lib/server/estimate-feedback/recommendations.ts`.
- Add `GET/POST app/api/insights/recommendations/route.ts`.
- Generate recommendations from current trend query outputs.

Initial rules only:
- labor production rate adjustment
- supplies baseline adjustment
- no-change / stable paint coverage

Recommendation fields:
- target_setting_key
- current_value_json
- suggested_value_json
- reason
- evidence_json
- confidence_label (`low`, `medium`, `high`)
- based_on_job_count
- status (`open`, `dismissed`, `applied`, `stale`)
- applied_setting_set_id nullable
- created_at, updated_at, applied_at, dismissed_at

Target key convention:
- Use a stable string derived from setting values, for example `production_rates_walls:<row_id>:sqft_per_hr` or `supply_rates_area_based:<row_id>:cost_per`.
- Keep parsing/validation in the recommendation domain, not in route handlers.

Success criteria:
- trends screen can show actionable cards from real locked review evidence
- duplicate open recommendations for the same target/evidence are avoided
- tests cover all three initial rules and status transitions

Out of scope:
- applying recommendations
- ML or probabilistic recommendations
```

## Prompt 14: Apply Recommendation Workflow (Implemented)

```text
Read `docs/feature-page-prompt-template.md` and `docs/quotes-architecture.md`.

Fresh-chat context:
This builds on Prompts 2, 4, and 13. Recommendations should exist, and the setting-set service must support clone/update/activate with audit logging. This prompt wires the safe apply action so future estimates change while old estimates and snapshots stay unchanged.

Status note:
Implemented in the working tree with `applyTrendRecommendation` in `lib/server/estimate-feedback/recommendations.ts` and `app/api/insights/recommendations/[id]/apply/route.ts`.

Implement:
Apply recommendation action.

Feature scope:
- Add `POST app/api/insights/recommendations/[id]/apply/route.ts`.
- Add service function that validates the recommendation is still current.
- Clone active setting set, modify the target setting value, activate the new set, write `setting_change_log`, and mark recommendation applied.
- Store `applied_setting_set_id` on `trend_recommendation`.

Rules:
- applying changes future estimates only
- old estimates and snapshots continue to read their stored `setting_set_id_used`
- if current active value no longer matches recommendation current value, mark recommendation stale and return conflict
- all setting mutations must go through the setting set service from Prompt 2

Success criteria:
- clicking Apply changes active settings for future estimates
- old jobs/snapshots remain unchanged
- audit trail shows old value, new value, reason, actor, and recommendation id
- tests cover success, stale recommendation conflict, and historical estimate stability

Out of scope:
- multi-setting recommendations
- partial apply
```

## Prompt 15: Recommendation Cards UI (Implemented)

```text
Read `docs/feature-page-prompt-template.md` and `docs/crm-ui-system.md`.

Fresh-chat context:
This builds on Prompts 12, 13, and 14. The Trends page, recommendation generation, and apply/dismiss APIs should already exist. This prompt only adds UI/controller integration for those existing APIs.

Status note:
Implemented in the working tree by extending `app/crm/insights/_hooks/useInsightsTrendsPage.ts`, `app/crm/insights/_hooks/insightsTrendsVm.ts`, `app/crm/insights/InsightsPageContent.tsx`, and `lib/estimate-feedback/client.ts`.

Implement:
Recommendation cards on the Trends page.

Feature scope:
- Extend `app/crm/insights` hooks/controller/VM to load recommendations.
- Render open recommendation cards with current value, suggested value, confidence, evidence, Apply, and Dismiss.
- Add apply/dismiss client actions through `lib/estimate-feedback/client.ts`.

Success criteria:
- cards are populated from DB recommendations
- Apply uses the workflow from Prompt 14
- applied cards update UI without stale local math
- dismissed cards no longer appear in open recommendations
- tests cover VM and action flows

Out of scope:
- generating recommendations in the browser
- editing suggested values inline
```

## Prompt 16: Data Quality Hardening

```text
Read `docs/feature-page-prompt-template.md`.

Fresh-chat context:
This builds on Prompts 9, 11, and 13. Review data quality fields, trend queries, and recommendations should already exist. This prompt hardens exclusions so bad or intentionally excluded jobs cannot affect averages or recommendations.

Implement:
Data quality controls across review, trend, and recommendation layers.

Feature scope:
- Ensure review flow owns `data_quality_status`, `exclude_from_trends`, and `change_order_present`.
- Update trend and recommendation queries to use only locked, valid, non-excluded reviews.
- Add optional outlier guards in the trend service, but keep explicit user exclusion as the source of truth.

Success criteria:
- invalid/questionable/excluded reviews do not affect trends or recommendations
- review UI makes data quality status and exclusion visible
- tests prove bad data cannot poison averages

Out of scope:
- automatic anomaly detection beyond simple outlier thresholds
```

## Prompt 17: Scope/Room Actuals Later

```text
Read `docs/feature-page-prompt-template.md`, `ARCHITECTURE.md`, and `docs/quote-estimate-architecture.md`.

Fresh-chat context:
This is a later expansion after Prompts 7 through 16 are stable in production-like use. Job-level actuals/reviews/trends should already work. Do not add line-level actuals until they clearly improve recommendation quality.

Implement:
Line-level actuals after job-level actuals/reviews/trends are stable.

Feature scope:
- Add `job_actuals_line`.
- Tie actual lines to `job_actuals`, `estimate_snapshot_line`, room id, and line kind.
- Extend review metrics to support scope-level and room-level variance without changing existing job-level metrics.
- Extend actuals UI only where line-level entry materially improves recommendations.

Success criteria:
- existing job-level actuals and trends continue working
- line actuals improve scope/category trend logic
- tests cover aggregation from line actuals back to job-level review metrics

Out of scope:
- replacing job-level actuals
- analytics summary tables
```

## Prompt 18: Analytics Optimization Later

```text
Read `docs/feature-page-prompt-template.md`.

Fresh-chat context:
This is a later optimization after direct trend queries are in use and have measurable performance issues. Locked reviews remain the source of truth; any summary table or materialized view is only a derived cache.

Implement only if trend queries are measurably slow:
Analytics optimization for the estimate feedback loop.

Feature scope:
- Profile current trend queries first.
- Add materialized summaries, trend runs, or fact tables only where query plans justify it.
- Keep locked reviews as the authoritative source; summaries are derived caches.

Success criteria:
- documented before/after query performance
- cache refresh/invalidation strategy is explicit
- trends numbers match raw locked-review queries

Out of scope:
- changing business definitions of metrics
- adding optimization before there is enough data to justify it
```
