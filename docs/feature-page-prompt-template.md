# Single-File Feature Build Prompt

Use this file as the only document you hand to Codex for a new feature or page request.

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

Before planning or coding, read these project docs in this order:

1. `ARCHITECTURE.md`
2. `docs/app-architecture-standards.md`
3. `docs/crm-ui-system.md`
4. `docs/jobs-architecture.md` when the work touches jobs, schedules, calendars, stage flow, or job detail surfaces

Then inspect the existing code paths, shared UI, domain modules, route handlers, hooks, and types that relate to the requested feature before proposing changes.

If the requested work is estimator-specific, also treat `ARCHITECTURE.md` as the source of truth for estimator layering, naming, and value separation.

## Non-Negotiable Constraints

1. **Fit the larger system first**
   - Reuse existing patterns, flows, naming, and placement.
   - Do not introduce parallel architecture when a shared one already exists.

2. **Reuse before creating**
   - Reuse shared UI components, hooks, helpers, API clients, validation, and domain logic first.
   - Add new primitives only when reuse is not possible.

3. **No custom one-off logic unless it is truly necessary**
   - If you add custom logic, explain why reuse failed and why this is the smallest safe exception.
   - Keep exceptions isolated and easy to remove later.

4. **Keep business logic out of pages and components**
   - Put business rules in shared domain or service modules.
   - Keep route handlers and pages as orchestration layers.

5. **Preserve architecture vocabulary and layering**
   - Follow the naming and placement conventions from the docs above.
   - For estimator logic, keep input, derived, override, and effective values clearly separated.

## Required Workflow

1. **Discovery pass**
   - Read the architecture docs above.
   - Identify exact reuse candidates in the codebase.
   - State where the new feature plugs into the current system.

2. **Implementation plan**
   - Provide a short step-by-step plan with the files you expect to touch.
   - Call out API, type, data, migration, and test impact if relevant.

3. **Build**
   - Implement with minimal, focused changes.
   - Prefer extending existing modules over duplicating patterns.

4. **Self-check before finishing**
   - Confirm no duplicate UI primitives or parallel API/domain abstractions were introduced.
   - Confirm auth, validation, response envelopes, and data-loading patterns match project standards.
   - Confirm edge cases and error states were handled.

## Output Format

Return your response in this structure:

1. **Architecture fit summary**
   - How the change fits the existing system
   - What was reused
   - What was newly introduced, if anything, and why

2. **File-by-file change list**
   - For each file: purpose and why the location matches the architecture

3. **Risk or exception log**
   - Any one-off additions with explicit justification

4. **Validation checklist**
   - Shared UI reused
   - Shared API or domain logic reused
   - No duplicated business rules in components
   - Naming and structure conform to the architecture docs
   - Tests and checks run

---

## Request Fields To Fill In

When you ask for a feature, include as many of these as are useful:

- **Feature/page name**
- **User/role/job-to-be-done**
- **Success criteria**
- **Out of scope**
- **Data contract notes**
- **Performance expectations**
- **Permissions/security rules**
- **Migration/backfill plan**
- **Telemetry/observability**
- **Definition of done**

## Copy/Paste Request Starter

```text
Read docs/feature-page-prompt-template.md and follow it.

Implement:
[FEATURE/PAGE NAME]

User / job to be done:
[WHO THIS IS FOR AND WHAT THEY NEED]

Success criteria:
- [criterion]
- [criterion]

Out of scope:
- [non-goal]

Definition of done:
- [tests/checks expected]
```
