# CRM Notes

Guardrails for changes in `app/crm/notes`.

## Data Flow

- `app/api/notes/*`: route adapters only. Authenticate, parse request input, apply notes-domain filtering/pagination, and return stable notes envelopes here.
- `lib/notes/client/*`: client orchestration only. Hooks own read state, mutation refresh behavior, pagination state, and page-facing view data.
- `app/crm/notes/**/page.tsx`: page composition only. Pages should render hook output and delegate interactions instead of re-implementing fetch or mutation logic.

## Composer Architecture

- `app/crm/notes/_components/TaskComposer.tsx` and `NoteComposer.tsx`: presentational overlays only.
- `useTaskForm` and `useNoteForm`: integration hooks for load/save orchestration.
- `lib/notes/forms/*`: canonical notes form models, normalization, dirty tracking, and submit/error handling.
- Keep query-param-based composer opening through `NotesComposerMount` and the route helper utilities.

## Mutation Pattern

- Standard read helpers live in `lib/notes/client/core.ts`.
- Shared mutation behavior goes through `useNotesMutation`: request, normalized error handling, local refresh, and optional `router.refresh()`.
- New note/task/folder mutations should extend the existing notes client hooks rather than reintroducing page-local `authedFetch` flows.

## Change Placement

- Task and note business rules belong in `lib/notes/*` domain helpers or route-level query helpers, not in pages or presentational components.
- Folder orchestration belongs in `useFolderActions` and the folder routes.
- Detail-view presentation belongs in `app/crm/notes/notes/[id]/_components.tsx`.
- Shared notes explorer presentation belongs in `app/crm/notes/notes/_components.tsx`.

## Testing Expectations

- Route contract/filter/pagination coverage belongs in `app/api/notes/__tests__`.
- Hook and page interaction coverage belongs in `app/crm/notes/__tests__`.
- Pure domain logic belongs in `lib/notes/__tests__`.
- Run the notes component slice, notes node tests, route tests, and `npm run typecheck` after changes here.
