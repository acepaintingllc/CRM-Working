# Estimate Push Prep

Current branch: `feat-estimate-workflow-stabilization`

## Before Push

1. Run checks:
   - `cmd /c npm run lint`
2. Apply DB migration:
   - `supabase/sql/028_estimate_ceiling_segments_height_override.sql`
   - `supabase/sql/029_estimate_jobsettings_scope_primer_products.sql`
3. Verify these flows manually:
   - Walls `Skip` stays `N` after Recalculate
   - Ceiling-only rooms recalc successfully
   - Ceiling segment height override optional + room-height fallback
   - Rollers include segment wall color overrides
   - Segment calc method changes only edited row

## Suggested Commit Buckets

1. Estimate UI behaviors
   - `app/crm/estimates/[id]/page.tsx`
2. Estimate API persistence
   - `app/api/estimates/[id]/route.ts`
3. Spreadsheet mapping
   - `lib/server/estimateSpreadsheet.ts`
4. Database migration
   - `supabase/sql/028_estimate_ceiling_segments_height_override.sql`

## Example Commit Commands

1. `git add "app/crm/estimates/[id]/page.tsx"`
2. `git commit -m "fix(estimates-ui): segment, roller, and ceiling behavior updates"`
3. `git add "app/api/estimates/[id]/route.ts"`
4. `git commit -m "fix(estimates-api): preserve walls/ceiling segment fields on save"`
5. `git add "lib/server/estimateSpreadsheet.ts"`
6. `git commit -m "fix(estimate-sheet): map complexity and ceiling height override headers"`
7. `git add "supabase/sql/028_estimate_ceiling_segments_height_override.sql"`
8. `git commit -m "feat(db): add ceiling height override on ceiling segments"`

## Push

1. `git push -u origin feat-estimate-workflow-stabilization`
