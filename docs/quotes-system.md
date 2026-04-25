# Quotes System — Entrypoint

This is the entrypoint for all quotes system work. It covers the Products editor, Rates/Flags editor, Quote Home, Version Creation workflow, and the route alias layer over canonical estimate pages.

## Always read both before any action

1. `docs/quotes-architecture.md` — layer map, existing abstractions, non-negotiables, anti-patterns, file ownership, and what changes are permitted
2. `docs/quotes-review-prompt.md` — scoring rubric, quotes-specific review lens, and rewrite target format

For build and refactor tasks, also read `docs/feature-page-prompt-template.md`. The architecture file supplements it with quotes-specific rules.

**Adding a new page or feature?** Go directly to the **"Adding a New Quotes Page: Canonical Recipe"** section in `docs/quotes-architecture.md`. It contains the exact folder/file structure, naming formula, per-file responsibility rules, which abstractions to reuse, the orchestration decision tree, required test files, and a list of things that will fail review. Do not invent structure — follow the recipe.

---

## How to use

```
Read docs/quotes-system.md and follow it.

Task: [review | build | refactor | rewrite]
Scope: [files or area]
Goal: [what you want]

Success criteria:
- [criterion]

Out of scope:
- [non-goal]
```

**For a review:** Read the scoped files, score them using the review prompt, and produce a ranked list of rewrite targets.

**For a build / refactor / rewrite:** Read the architecture constraints first, identify what already exists and can be reused, then implement with minimal scope. Follow the definition of done in the architecture file before declaring anything complete.
