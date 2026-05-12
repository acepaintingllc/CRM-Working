# Post-Acceptance Operations Architecture

This document defines the product and architecture decisions for operational work after a customer accepts a quote. It is a planning contract for future feature work, not an implementation of work orders, invoices, change orders, or color confirmation.

## Existing Anchors

- Public quote acceptance delegates operational side effects to `lib/server/accepted-estimates/service.ts`.
- `jobs.linked_estimate_id` is the canonical accepted estimate link for operational job workflows.
- `loadAcceptedEstimateSource` in `lib/server/accepted-estimates/service.ts` is the canonical loader for accepted estimate source data.
- `types/jobs/api.ts` exposes `JobAcceptedEstimateDetail` for job detail read models, but this is a summary/audit projection, not a replacement for the accepted estimate source loader.
- Job board and detail workflow statuses are currently defined in `lib/jobs/types.ts`; operational document statuses should be separate from those lifecycle statuses unless explicitly mapped.

## Source Of Truth

The accepted estimate is the immutable source for the original customer-approved scope and price.

Acceptance creates or resolves:

1. the accepted estimate row
2. the accepted public version
3. the accepted estimate snapshot row
4. the job link through `jobs.linked_estimate_id`

After acceptance, downstream operations must read the accepted source through `lib/server/accepted-estimates/service.ts`. They must not pick the first estimate for a job, recompute ownership from route aliases, or mutate the accepted estimate to express operational changes.

## Immutable Snapshot Policy

Accepted estimate snapshots are append-only historical records.

Rules:

- The original accepted estimate snapshot must not be edited in place.
- Repair of missing, legacy, or invalid accepted snapshots must create an additive replacement path; existing snapshot rows remain historical evidence.
- Work order, invoice, change order, and color confirmation features may store their own operational records that reference the accepted estimate snapshot.
- Operational records may include copied display data for rendering stability, but must keep a pointer back to the accepted estimate source used to generate them.
- Any regenerated operational document must create a new revision record instead of rewriting the previous generated document.
- Draft estimate inputs, room templates, and job templates may create future drafts, but must never change an accepted estimate, accepted public version, or accepted snapshot.

## Public And Customer Access Model

The customer-facing quote token is not the long-term operations token.

Rules:

- The public quote token remains tied to the sent quote/public version and acceptance audit.
- Post-acceptance customer surfaces use a dedicated post-acceptance token with its own lifecycle, permissions, and revocation.
- Color confirmation should use the post-acceptance token, not assume the quote token remains valid forever.
- The post-acceptance token should resolve to one job and organization, then authorize only explicitly exposed customer actions for that stage.
- Customer write access is limited to operational inputs the product exposes, such as color selections or confirmation. It cannot alter the accepted estimate source.
- Internal CRM access continues to use authenticated org/session guards and service-layer authorization.

This creates a clean boundary: quote acceptance is an audit event, while post-acceptance collaboration is a separate customer portal session.

## Job Operations Statuses

Job operations statuses describe the post-acceptance production workflow. They should be distinct from quote-board statuses such as `estimate_sent`, `follow_up`, `scheduled`, and `completed`.

Recommended initial statuses:

| Status | Meaning |
| --- | --- |
| `accepted` | Quote was accepted and linked to the job, but operations have not started. |
| `color_selection_open` | Customer or staff can enter color selections. |
| `color_selection_submitted` | Customer submitted color choices, pending internal review. |
| `color_selection_confirmed` | Color selections are approved for production documents. |
| `work_order_draft` | A work order draft exists but has not been issued to production. |
| `work_order_issued` | The current work order revision is issued for production. |
| `scheduled` | Production schedule is set. This may map to the existing job status, but should not replace document statuses. |
| `in_progress` | Production work has started. |
| `completed` | Production work is complete. This may map to the existing job status when the job is closed. |
| `closed` | Final invoice/payment workflow is complete. |
| `cancelled` | Accepted job will not proceed operationally. The accepted estimate remains historical. |

Document statuses should stay separate from job operations statuses. For example, a job can be `in_progress` while a change order is `pending_customer_acceptance`.

## Document Lifecycle Rules

Operational documents are generated records with revision history.

Shared document rules:

- Every generated document records the accepted estimate source id, accepted snapshot id when available, source version/kind, generated timestamp, and generating user/process.
- A document revision is immutable once issued, sent, accepted, voided, or superseded.
- Regeneration creates a new revision and marks the previous current revision as superseded when appropriate.
- Draft revisions may be discarded or regenerated before issuance if no customer-facing or production-facing action depends on them.
- Voiding a document does not delete it and does not modify the accepted estimate source.

Work order lifecycle:

- Work orders start from the accepted estimate operational source.
- Work orders are generated snapshots for production use.
- Work orders can include confirmed colors, production notes, sequencing, and internal instructions.
- Work orders can be regenerated as revisions when operational information changes.
- A regenerated work order revision must reference the same accepted estimate source plus any additional operational inputs used, such as color confirmations or accepted change orders.

Invoice lifecycle:

- Invoices start from accepted quote total.
- Invoice balance is calculated as accepted quote total plus accepted change orders minus payments and credits.
- Invoice lines may be generated for customer readability, but the financial base is the immutable accepted estimate plus accepted deltas.
- Regenerating an invoice creates a new invoice revision or invoice document; it must not mutate the accepted estimate.

Change order lifecycle:

- Change orders are operational delta documents.
- A change order does not mutate the original accepted estimate.
- Draft change orders may be edited until issued.
- Issued change orders require acceptance or explicit internal cancellation.
- Accepted change orders become additive/subtractive deltas used by later work order and invoice revisions.
- Rejected, cancelled, or expired change orders remain audit records and are excluded from invoice totals unless a future policy explicitly says otherwise.

## Accepted Estimate Data Reads

Work orders, invoices, and change orders read accepted data through the accepted estimate source loader.

Required read pattern:

1. Resolve the operational accepted estimate for the job through `jobs.linked_estimate_id`, with only the documented legacy fallback from `lib/server/accepted-estimates/service.ts`.
2. Load the canonical accepted estimate snapshot and operational source.
3. Build the operational document from that immutable source plus the relevant operational records.
4. Persist the generated document/revision with source references.

Feature-specific reads:

- Work orders read accepted rooms, scopes, calculations, access fees, prejob data, and confirmed color selections.
- Invoices read accepted `final_total`, accepted change order totals, payments, and credits.
- Change orders read the accepted estimate source for context and comparison, but store only the operational delta and acceptance result.

If a feature only has `JobAcceptedEstimateDetail`, it has enough for display/audit summaries but not enough to generate operational documents.

## Templates And Draft Inputs

Room templates and job templates are draft-input helpers.

Rules:

- Templates may create new draft estimate inputs.
- Templates may prefill future room/scope structures before a quote is accepted.
- Templates may support internal operational planning records after acceptance only if those records are separate from the accepted estimate source.
- Templates must never mutate accepted jobs, accepted estimates, accepted public versions, accepted snapshots, issued work orders, issued invoices, or accepted change orders.

## Lifecycle Walkthrough

The post-acceptance lifecycle should work without changing the original accepted estimate:

1. Customer accepts a quote in the public quote portal.
2. Acceptance marks the estimate accepted, preserves the accepted public version, creates/resolves the accepted snapshot, and links `jobs.linked_estimate_id`.
3. The CRM creates or exposes a dedicated post-acceptance customer token for operational collaboration.
4. Customer confirms colors through the post-acceptance portal. Color confirmation is stored as an operational record tied to the job and accepted estimate source.
5. Staff generates a work order revision from the accepted estimate source plus confirmed colors and production notes.
6. If operations change, staff creates a change order as a delta document. Once accepted, it is included in future operational totals and document revisions.
7. Staff regenerates the work order when needed, producing a new revision that references the original accepted estimate source and accepted operational deltas.
8. Invoice generation starts from the accepted quote total, adds accepted change orders, subtracts payments/credits, and records its own immutable invoice revision.

At no point does color confirmation, work order generation, invoice generation, change order acceptance, or template use mutate the original accepted estimate.

## Implementation Gate

Before feature code begins, the team should be able to describe:

- how a customer gets from quote acceptance to a post-acceptance color portal
- how a confirmed color record becomes input to a generated work order revision
- how an accepted change order affects future work order and invoice revisions
- how invoice totals are derived from accepted quote total plus accepted deltas minus payments/credits
- why the original accepted estimate snapshot remains unchanged across the entire lifecycle

If the answer requires editing the accepted estimate or accepted snapshot, the feature design violates this architecture.
