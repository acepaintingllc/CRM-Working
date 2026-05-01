# CRM UI System Standard

## Purpose

Defines the shared operational CRM UI system and when dense workspace UI may diverge.

## UI Families

| Family | Owns | Use for |
| --- | --- | --- |
| Shared CRM UI | Operational CRM shell, list/detail/board/settings page structure, notices, empty states, common actions | normal CRM pages |
| ace-v2 workspace UI | Dense quote/estimator editor surfaces with custom tooling | canonical quote/estimate editor and Estimator V2 workspaces |

Default to shared CRM UI unless the page is a true workspace with materially different interaction density.

## Shared CRM Primitives

| Need | Use first |
| --- | --- |
| Page frame | `CrmPageShell` |
| Page title/actions | `CrmPageHeader` |
| Primary section | `CrmSectionCard` |
| Success/error/info/warning | `CrmNotice` |
| Empty workflow/result | `CrmEmptyState` |
| Search/filter input | `CrmSearchBar` |
| Button/action | `CrmButton` |
| Pill/status marker | `CrmChip` |
| Standard resource state | `CrmResourceState` |

Do not add custom page chrome, button styles, pills, notices, or empty states until these primitives do not fit.

## Composition Order

1. Page shell
2. Page header
3. Notices
4. Search / filters
5. Content cards / boards / forms
6. Empty states where applicable

## Visual Rules

- Base operational CRM pages on the quote-family token system in `app/globals.css`.
- Use the lighter CRM token layer, not the full dark workspace shell.
- Keep mono eyebrow labels, border treatment, spacing rhythm, chips, and surfaces aligned with shared CRM pages.
- Emoji may appear in page headers, section headers, empty states, and small decorative chips.
- Emoji must not be the only status signal.
- Avoid emoji in dense forms, tables, destructive actions, and compact operational controls.

## When Deviation Is Allowed

| Feature shape | Shared CRM required? | Notes |
| --- | --- | --- |
| CRUD, list, detail, board, settings | Yes | Use standard primitives and app architecture defaults. |
| Dense tabbed admin editor | Partially | Keep CRM shell/resource states; route-local dense panels may differ. |
| Quote/estimate editor workspace | No, workspace exception | Use quote/estimator workspace patterns and domain docs. |
| Estimator V2 workspace | No, workspace exception | Keep custom state/UI where complexity requires it. |
| One-off visual preference | Yes | Not a valid reason to diverge. |

## Quote Home Boundary

- `app/crm/quotes/QuotesHomePage.tsx` is a standard CRM page, not a workspace exception.
- Keep page framing on shared CRM primitives such as `CrmPageShell`, `CrmPageHeader`, `CrmNotice`, `CrmButton`, and `CrmChip`.
- Route-local quote-home panels may keep quote-family treatment for job/version workflow content.
- The quote editor/workspace exception starts at the canonical estimate/quote editor routes.

## Anti-Patterns

- Custom shell/header/card/button/chip styles for ordinary CRM pages.
- Nested card layouts where a standard section plus list/table/form would work.
- Workspace visual language on operational CRUD pages.
- Emoji-only statuses.
- Page-level quote/editor exceptions leaking into quote home or unrelated CRM pages.
