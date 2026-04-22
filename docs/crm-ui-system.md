# CRM UI System Standard

This app has two related UI families:

- `ace-v2 workspace UI`: the quote and estimator workspace surfaces.
- `shared CRM UI`: the lighter operational CRM shell used for list, detail, board, and settings pages.

## Default choice

Use the shared CRM UI for normal CRM pages unless the feature is a quote-editor-style workspace with dense custom tooling.

## Shared CRM UI rules

- Start pages with `CrmPageShell`.
- Use `CrmPageHeader` for the main header.
- Use `CrmSectionCard` for primary content sections.
- Use `CrmNotice` for success, error, info, and warning states.
- Use `CrmEmptyState` for empty results or empty workflow states.
- Use `CrmSearchBar` for page-level and section-level search/filter inputs.
- Use `CrmButton` and `CrmChip` before introducing custom button or pill styling.

## Emoji policy

- Allowed: page headers, section headers, empty states, and small decorative chips.
- Not allowed as the only status signal.
- Avoid emoji in dense forms, tables, and destructive actions by default.

## Composition order

1. Page shell
2. Page header
3. Notices
4. Search / filters
5. Content cards / boards / forms
6. Empty states where applicable

## Visual direction

- Base the CRM shell on the quote-family token system in `app/globals.css`.
- Use the lighter CRM token layer, not the full dark workspace shell, for operational pages.
- Keep mono eyebrow labels, border treatment, spacing rhythm, chips, and surface styling aligned with the quote-family system.

## Divergence rule

Only diverge from the shared CRM UI when the feature is a true workspace with materially different interaction density or visual requirements. If a page is mostly CRUD, list/detail, board, or settings work, it should stay on the shared CRM UI system.
