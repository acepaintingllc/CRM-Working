# Shared Estimator Types

Use this folder for estimator types shared across:

- route UI
- API handlers
- shared domain logic

Current files:

- `core.ts`
- `walls.ts`
- `materials.ts`
- `pricing.ts`
- `index.ts`

Rule:
If a type is only used by one route component, keep it local instead of promoting it here.
