# Documentation Layout

Use `ARCHITECTURE.md` and `AGENTS.md` as the top-level routing docs. This folder keeps canonical architecture separate from process prompts, checklists, and historical notes.

## Canonical Architecture

- `architecture/app-architecture-standards.md` - route handlers, services, validation, and response contracts.
- `architecture/crm-ui-system.md` - CRM UI primitives and page framing.
- `architecture/quote-estimate-architecture.md` - quote, estimate, pricing, products, rates, flags, and Estimator V2.
- `architecture/jobs-architecture.md` - jobs, stages, schedules, calendar, and workflow/email transitions.
- `architecture/quotes-architecture.md` - supporting quote implementation details. Read only when quote/estimate architecture points you here or the task needs page-level quote implementation detail.

## Supporting Process Docs

- `guides/` - reusable operational guides and manual QA checklists.
- `templates/` - prompt templates and review rubrics. Use only when a task explicitly needs that process.
- `archive/` - historical or one-off planning material, including early Estimator V2 planning specs. Do not treat these files as current source of truth unless a user explicitly references them.
