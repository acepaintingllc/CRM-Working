# Estimator V2 System - Entrypoint

This is the entrypoint for all Estimator V2 system work. It covers the canonical estimate editor and summary implementation, route-local V2 UI, estimator state, shared estimator calculators, rollups, pricing policies, serializers, shared types, and quote-facing aliases that compose the canonical estimate pages.

## Always read before any action

1. `ARCHITECTURE.md` - top-level Estimator V2 design intent, relationship model, value-layer rules, pricing policy rules, folder strategy, and unresolved decisions.
2. `docs/quote-estimate-architecture.md` - canonical ownership rules for estimate routes vs quote aliases, shared server layer boundaries, and quote/estimate vocabulary rules.
3. `docs/app-architecture-standards.md` - default route-handler, service, validation, response envelope, and shared architecture expectations.
4. `docs/crm-ui-system.md` - CRM UI shell and component rules, including when dense estimator workspace UI is allowed to differ from ordinary CRM pages.

For build and refactor tasks, also read `docs/feature-page-prompt-template.md`. The template supplies the full discovery, implementation, validation, and final-response workflow for new features and pages.

If the work touches quote-facing routes, labels, navigation, send/review flows, quote home, products, rates, or flags, also read `docs/quotes-system.md` and follow the quote-system entrypoint for that slice.

---

## Canonical ownership

- `app/crm/estimates/[id]/v2` is the only canonical Estimator V2 editor and summary implementation.
- `app/crm/quotes/[id]` is a quote-facing route alias and composition layer only.
- Route-local estimator UI belongs under:
  - `app/crm/estimates/[id]/v2/_components`
  - `app/crm/estimates/[id]/v2/_lib`
  - `app/crm/estimates/[id]/v2/_state`
- Shared estimator domain logic belongs under `lib/estimator`.
- Shared estimator types belong under `types/estimator`.
- Shared quote/estimate collection server work belongs behind the existing estimate-collection repository/service/route-handler layers.

Do not create quote-side `_components`, `_state`, `_lib`, or `summary/_*` trees for V2 behavior. New V2 behavior goes in the canonical estimate route or shared estimator modules, then quote routes compose it.

---

## Non-negotiables

- Keep `Estimate` as the canonical internal domain term for shared logic.
- Use `Quote` only for user-facing route labels, navigation, and quote-specific composition.
- Keep input, derived, override, and effective values clearly separated in naming, state, types, and calculations.
- Keep route entrypoints thin: resolve params, authenticate when needed, load through approved services, mount canonical content, and apply route-specific labels/navigation.
- Do not guess unresolved behavior listed in `ARCHITECTURE.md`. If a decision is still open there, keep it explicit and ask for a product choice before encoding durable behavior.
- Do not duplicate business logic between quote routes and canonical estimate routes.
- Do not bypass shared service, route helper, validation, API client, or domain modules when one already owns the behavior.

---

## How to use

```text
Read docs/estimator-v2-system.md and follow it.

Task: [review | build | refactor | rewrite]
Scope: [files or area]
Goal: [what you want]

Success criteria:
- [criterion]

Out of scope:
- [non-goal]
```

**For a review:** Read the required docs, inspect the scoped estimator files, then produce findings first. Prioritize architecture violations, calculation/value-layer mixing, quote/estimate ownership drift, duplicated logic, missing tests, unclear persistence contracts, and UI workflow regressions.

**For a build / refactor / rewrite:** Read the architecture constraints first, identify what already exists and can be reused, confirm canonical placement, then implement with minimal scope. Follow the feature-page workflow before declaring the work complete.

---

## Adding a new Estimator V2 feature

Use this placement decision tree before writing code:

1. **Is it route UI, editor layout, local interaction state, or page-specific orchestration?**
   Put it under `app/crm/estimates/[id]/v2`.

2. **Is it calculation, normalization, rollup, pricing policy, serialization, or reusable transform logic?**
   Put it under `lib/estimator`.

3. **Is it a shared type used by route UI, API handlers, and domain logic?**
   Put it under `types/estimator`.

4. **Is it quote-facing labeling, navigation, or composition over the canonical estimator page?**
   Keep it thin under `app/crm/quotes/[id]` and compose estimate-side behavior.

5. **Is it server-side quote/estimate collection loading or mutation behavior?**
   Use the existing repository -> service -> route handler pattern from `docs/quote-estimate-architecture.md`.

6. **Does it touch jobs, scheduling, stage transitions, or email workflow?**
   Read `docs/jobs-architecture.md` and keep workflow side effects in the canonical jobs layers.

## Definition of done

- Canonical placement is documented in the final response.
- Existing route, hook, service, UI, type, and estimator-domain patterns were reused where available.
- No parallel quote/estimate abstractions were introduced for the same concept.
- Input, derived, override, and effective values remain separate and testable.
- Route handlers, if changed, use required auth, parsing, validation, and project-standard envelopes.
- Relevant tests or checks were run, or the reason they could not be run is stated.
