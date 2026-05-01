# Quotes System Entrypoint

Read `docs/architecture/quote-estimate-architecture.md` first for all quote, estimate, pricing, products, rates, flags, and Estimator V2 work. It is the canonical architecture source of truth.

Use these supporting docs only when they match the task:

- `docs/architecture/quotes-architecture.md` - detailed historical layer map, file ownership notes, and page recipe examples.
- `docs/templates/quotes-review-prompt.md` - review rubric and rewrite-target output format.
- `docs/guides/quotes-estimate-v2-acceptance-checklist.md` - manual QA checklist for major Estimator V2 or customer quote workflow changes.
- `docs/templates/feature-page-prompt-template.md` - general workflow for new feature or page builds.

## How To Use

```text
Read docs/architecture/quote-estimate-architecture.md and follow it.

Task: [review | build | refactor | rewrite]
Scope: [files or area]
Goal: [what should change]

Success criteria:
- [criterion]

Out of scope:
- [non-goal]
```

For build/refactor work, identify the canonical owner and existing abstraction before editing. For reviews, use the review prompt after reading the scoped code.
