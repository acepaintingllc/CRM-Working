# Estimator Strict Inputs Design

## Purpose

Estimator V2 should not silently price work from hidden production, material, or pricing defaults. If a calculator needs business configuration, it should use explicit scope input, quote/job settings, product catalog data, rates, flags, or template rows. Missing configuration should surface as a missing input so the estimator can correct the system data.

## Scope

This change covers calculator behavior for walls, ceilings, doors, and the closely related editor draft defaults.

In scope:

- Remove hidden calculator fallbacks for production rates, coverage, coats, spot prime percent, labor rate, supply rates, and paint or primer prices.
- Remove vaulted ceiling fallback area factor and plane count.
- Stop defaulting vaulted plane count in the editor draft.
- Require door quantity and side count instead of assuming one door with two sides.
- Keep drywall quantity ceiling behavior because LF/SQFT repair quantities are intentionally rounded up for easier pricing.
- Keep current quote-level policy defaults as editable quote/template settings.

Out of scope for this pass:

- Moving wall door/window deduction values into a settings UI.
- Moving baseboard opening deduction into a settings UI.
- Redesigning rates/flags or quote defaults pages.
- Changing SQL schema beyond the existing vaulted measurement migration.

## Behavior

Wall and ceiling calculators should still return safe numeric outputs when configuration is missing, but the missing configuration must be visible in `missing_inputs`. The calculation should not use hardcoded business prices or rates as if they were configured values.

Vaulted ceiling behavior should be explicit:

- Direct `area_sf` remains the highest-priority measured total.
- Measured vaulted area requires ridge length, slope length, and plane count.
- Factor-based vaulted area requires a provided `vaulted_area_factor`.
- No code path assumes `1.2` or `2`.

Door behavior should be explicit:

- Door type still comes from the unit-rate catalog.
- Quantity is required unless a catalog default quantity exists.
- Sides is required.
- Missing quantity or sides should be reported in `missing_inputs`.

## Deferred Configuration

Two existing constants can stay temporarily because they are field-measurement conventions rather than hidden pricing:

- Standard wall opening deductions for doors/windows.
- Baseboard opening deduction.

They remain documented deferred work and are not changed by this strict-inputs pass.

## Testing

Add or update node tests that prove:

- Wall and ceiling calculators report missing pricing assumptions rather than relying on hidden defaults.
- Vaulted measured ceilings require plane count.
- Vaulted factor ceilings require `vaulted_area_factor`.
- Door scopes require quantity and sides.
- Existing valid configured inputs still calculate normally.
