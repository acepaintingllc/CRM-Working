# Single-File Feature Build Prompt

Use this file as the only document you hand to Codex for a new feature or page request.

## Do not use

- one-off business logic inside pages or components
- duplicate job/quote abstractions when one already exists
- direct DB or fetch calls that bypass shared clients/services
- guessing missing architecture signals from conventions

## Fast Usage

Say this:

```text
Read docs/feature-page-prompt-template.md and follow it.
Implement [FEATURE/PAGE NAME] for [USER/ROLE/JOB-TO-BE-DONE].

Success criteria:
- ...
- ...

Out of scope:
- ...
```

That is enough. This file is the entrypoint and tells Codex what else to read.

---

## Instructions For Codex

You are working inside this CRM codebase.

Before planning or coding, map the request and read project architecture docs in this order:

1. Always read: `ARCHITECTURE.md`  
   Why: canonical estimator architecture and global layering principles.
2. Always read: `docs/app-architecture-standards.md`  
   Why: route-handler + service boundaries, validation flow, and response envelopes.
3. Always read: `docs/crm-ui-system.md`  
   Why: default UI family and shared CRM shell rules.
4. Read `docs/quote-estimate-architecture.md` when request touches quote/estimate work, including Estimator V2 UI routes/aliases.  
   Why: canonical Estimate (shared domain) vs Quote (user-facing route label) ownership.
5. Read `docs/jobs-architecture.md` when request touches jobs, calendars, schedules, or stage/email workflow transitions.  
   Why: canonical job workflow status and schedule sync ownership.

Then inspect existing code paths, shared UI, domain modules, route handlers, hooks, and types that relate to the requested feature before proposing changes.

## Non-Negotiable Constraints

1. **Fit the larger system first**
   - Reuse existing patterns, flows, naming, and placement.
   - Do not introduce parallel architecture when a shared one already exists.

2. **Architecture and security are mandatory**
   - Route handlers must authenticate with `requireSessionUserOrg`.
   - Route handlers must use shared route helpers for parsing and service/domain modules for validation and business logic.
   - Return project-standard envelopes (`{ data }`, `{ data, notice? }`, `{ error }`) with status codes.

3. **Reuse before creating**
   - Reuse shared UI components, hooks, helpers, API clients, validation, and domain logic first.
   - Add new primitives only when reuse is demonstrably impossible.

4. **Default UI family**
   - Use shared CRM UI by default (`CrmPageShell`, `CrmPageHeader`, `CrmSectionCard`, `CrmNotice`, `CrmButton`, `CrmChip`).
   - Diverge only for genuinely dense workspace/editor flows where shared CRM UI is materially insufficient.

5. **Naming and vocabulary**
   - Use `Estimate` for shared logic and domain modules.
   - Use `Quote` only as user-facing labeling and route alias where required by product language.
   - For estimator logic, keep input, derived, override, and effective values clearly separated.

6. **Jobs workflow discipline**
   - Job status/stage behavior must stay in canonical jobs architecture.
   - Schedule and job-stage side effects must pass through existing sync/action layers, not inline route updates.

7. **No one-off logic unless explicitly justified**
   - If one-off logic is required, make it minimal, isolated, and easy to remove.

## Required Workflow

1. **Discovery pass**
   - Read required docs for the request classification.
   - Confirm exact canonical placement (route-local vs shared domain).
   - Identify reuse candidates in UI, hooks, services, parsers, validators.
   - Check API surface and contract boundaries before planning writes.

2. **Risk/exception capture (required before final plan)**
   - If reuse is not possible, explicitly log each missing shared abstraction.
   - Keep each exception minimal and isolated, with a removal path.

3. **Implementation plan**
   - Provide a step-by-step plan with expected touched files.
   - Call out API, type, data, migration/backfill, and test impact.

4. **Build**
   - Implement with minimal, focused changes.
   - Extend existing modules before creating new abstractions.

5. **Pre-finish validation**
   - Confirm no duplicate UI primitives or parallel API/domain abstractions.
   - Confirm auth, validation, response envelopes, and data-loading patterns match standards.
   - Confirm edge cases and errors are handled.

## Output Format

Return your response in this structure:

1. **Architecture fit summary**
   - How the change fits the existing system
   - What was reused
   - What was newly introduced, if anything, and why

2. **File-by-file change list**
   - For each file: purpose and why the location matches canonical ownership
   - Add API contract impact for any file that changes a route payload, schema, or service contract

3. **Risk or exception log**
   - Any one-off additions with explicit minimal/isolated justification

4. **Validation checklist**
   - Shared UI reused (with file references)
   - Shared API/domain logic reused (with file references)
   - No duplicated business rules in components
   - Naming and structure conform to architecture docs
   - Auth + route envelope patterns correctly used
   - Tests and checks run

Also include these sections:

- **API contract impact**
  - endpoint paths, request/response shapes, schema changes, status behavior.
- **Shared ownership proof**
  - per-change mapping to route layer, shared domain, shared UI, and validation/parse layer.

## Request Fields To Fill In

When you ask for a feature, include these required fields:

- Feature/page name
- User/role/job-to-be-done
- Success criteria
- Out of scope
- Feature scope
- Permission/security rules
- Data contract notes (request/response and state shape)
- Migration/backfill plan
- Observability/telemetry expectations
- Performance expectations
- Definition of done

If any required field is missing, treat it as blocking ambiguity and request clarification before planning.

## Copy/Paste Request Starter

```text
Read docs/feature-page-prompt-template.md and follow it.

Implement:
[FEATURE/PAGE NAME]

User / job to be done:
[WHO THIS IS FOR AND WHAT THEY NEED]

Feature scope:
- [scope statement]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]

Permissions/security:
- [roles, org boundaries, data visibility rules]

Data contract notes:
- [request/response contracts and invariants]

Migration/backfill plan:
- [if any schema, seed, or migration work is needed]

Observability/telemetry:
- [events/logs/metrics to emit]

Definition of done:
- [tests/checks expected]
```

### Example: Estimator / quote branch

```text
Read docs/feature-page-prompt-template.md and follow it.

Implement:
[FEATURE/PAGE NAME]

User / job to be done:
[WHO THIS IS FOR AND WHAT THEY NEED]

Feature scope:
- [feature scope]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]

Permissions/security:
- [roles / org-based guardrails]

Data contract notes:
- [payload + policy/alias rules]

Migration/backfill plan:
- [if estimate settings persistence changes]

Definition of done:
- [checks expected]
```

### Example: Jobs branch

```text
Read docs/feature-page-prompt-template.md and follow it.

Implement:
[FEATURE/PAGE NAME]

User / job to be done:
[WHO THIS IS FOR AND WHAT THEY NEED]

Feature scope:
- [feature scope]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]

Permissions/security:
- [roles and workflow stage access]

Data contract notes:
- [request/response contracts]

Migration/backfill plan:
- [if any schedule/status side effects need seed or backfill]

Observability/telemetry:
- [alerts/trace expectations]

Definition of done:
- [checks expected]
```
