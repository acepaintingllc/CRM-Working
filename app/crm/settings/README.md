# CRM Settings

This settings slice is organized around explicit domains rather than page-local fetch logic.

## Domains

- `company profile`
  Canonical business identity and sender defaults used in customer-facing flows.
- `quote send defaults`
  Defaults used by the Quote V2 send/review flow and customer-facing quote documents.
- `integrations`
  Navigation surface for provider setup and diagnostics, not a persisted settings blob.

Quote creation defaults are exposed through `/api/settings/quote-defaults` and back the Quotes defaults UI directly.
Quote V2 customer document settings live at `/crm/settings/quote-v2`.

## Route Contracts

- `GET /api/settings/company` -> `{ data: CompanyProfileSettings }`
- `PUT /api/settings/company` -> `{ data: CompanyProfileSettings, notice }`
- `GET /api/settings/quote-send-defaults` -> `{ data: QuoteSendDefaults }`
- `PUT /api/settings/quote-send-defaults` -> `{ data: QuoteSendDefaults, notice }`
- `GET /api/settings/quote-defaults` -> `{ data: QuoteDefaults }`
- `PUT /api/settings/quote-defaults` -> `{ data: QuoteDefaults, notice }`

Errors use `{ error }` with stable HTTP status codes.

## Client Pattern

New persisted settings pages should use:

1. A typed domain contract in `lib/settings`
2. A behavior-specific API route under `app/api/settings`
3. `useEditableResource` for load/save/dirty/error state
4. Shared settings primitives in `app/crm/settings/_components`

## Ownership Boundaries

- Do not add quote-send fields to estimate defaults routes.
- Do not add estimate defaults fields to quote-send routes.
- Do not read/write company profile from opportunistic `orgs` columns in new code.
