# CRM Settings

This settings slice is organized around explicit domains rather than page-local fetch logic.

## Domains

- `company profile`
  Canonical business identity and sender defaults used in customer-facing flows.
- `quote send defaults`
  Defaults used by the quote send/review flow and customer-facing quote documents.
- `integrations`
  Navigation surface for provider setup and diagnostics, not a persisted settings blob.

Estimate creation defaults still live separately and are exposed through `/api/settings/estimate-defaults` so the quote defaults UI does not rewrite unrelated estimate settings.

## Route Contracts

- `GET /api/settings/company` -> `{ data: CompanyProfileSettings }`
- `PUT /api/settings/company` -> `{ data: CompanyProfileSettings, notice }`
- `GET /api/settings/quote-send-defaults` -> `{ data: QuoteSendDefaults }`
- `PUT /api/settings/quote-send-defaults` -> `{ data: QuoteSendDefaults, notice }`
- `GET /api/settings/estimate-defaults` -> `{ data: EstimateDefaults }`
- `PUT /api/settings/estimate-defaults` -> `{ data: EstimateDefaults, notice }`

Errors use `{ error }` with stable HTTP status codes.

## Client Pattern

New persisted settings pages should use:

1. A typed domain contract in `lib/settings`
2. A behavior-specific API route under `app/api/settings`
3. `useSettingsResource` for load/save/dirty/error state
4. Shared settings primitives in `app/crm/settings/_components`

## Ownership Boundaries

- Do not add quote-send fields to estimate defaults routes.
- Do not add estimate defaults fields to quote-send routes.
- Do not read/write company profile from opportunistic `orgs` columns in new code.
