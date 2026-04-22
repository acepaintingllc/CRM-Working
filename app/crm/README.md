# CRM UI Standard

Normal CRM pages should default to the shared CRM primitive family:

- `CrmPageShell`
- `CrmPageHeader`
- `CrmSectionCard`
- `CrmDetailLayout`
- `CrmNotice`
- `CrmEmptyState`
- `CrmSearchBar`
- `CrmButton`
- `CrmChip`
- `CrmField`
- `CrmFormActions`
- `CrmDenseSurfaceCard`
- `CrmDenseMetaList`
- `CrmDenseActionRow`
- `CrmDenseSectionHeader`
- `CrmModalShell`
- `CrmModalHeader`
- `CrmModalSection`

## Rules

- Every normal CRM route starts with `CrmPageShell`.
- Every normal CRM route uses `CrmPageHeader` for page framing, title, navigation, and page-level actions.
- Primary content uses `CrmSectionCard`.
- Dense inner cards, compact metadata, and compact action rows use the shared dense CRM primitives.
- Feedback uses `CrmNotice`.
- Zero states use `CrmEmptyState`.
- Search and basic filtering start from `CrmSearchBar`.
- CRM modal workflows use the shared modal shell, header, and section primitives.

## Allowed Divergence

- Specialized bodies are allowed when the interaction model requires them.
- Examples: dashboard internals on CRM home, the jobs board columns, and the calendar month board.
- Even specialized pages should still use the shared CRM shell and header.
- Treat those surfaces as body-level exceptions only, not alternate page-shell systems.
- Specialized bodies should still use shared dense CRM primitives for surrounding cards, compact actions, metadata, and internal panels.

## Preferred Composition

Use this order for normal CRM pages:

`CrmPageShell -> CrmPageHeader -> notices/search -> CrmSectionCard or CrmDetailLayout`

Use this order for dense CRM internals:

`CrmSectionCard or CrmDetailLayout -> CrmDenseSurfaceCard -> CrmDenseSectionHeader / CrmDenseMetaList / CrmDenseActionRow`

## Deprecated Patterns

- Feature-local page shells for normal CRM routes
- Inline page-level styling and ad hoc top bars
- Separate shell/card/notice systems for settings
- Jobs-only button/card/input systems as the default page composition layer
