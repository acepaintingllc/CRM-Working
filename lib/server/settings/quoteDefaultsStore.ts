import { normalizeQuoteDefaults } from '@/lib/settings/quoteDefaults'
import type { QuoteDefaults } from '@/lib/settings/types'
import { supabaseAdmin } from '@/lib/server/org'

type Unsafe = Record<string, unknown>

export async function loadQuoteDefaults(orgId: string) {
  const res = await supabaseAdmin
    .from('estimate_template_settings')
    .select(
      'walls_paint_id, walls_primer_id, ceiling_paint_id, ceiling_primer_id, trim_paint_id, trim_primer_id, override_labor_rate'
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteDefaults((res.data ?? null) as Unsafe | null)
}

export async function saveQuoteDefaults(orgId: string, data: QuoteDefaults) {
  const res = await supabaseAdmin
    .from('estimate_template_settings')
    .upsert(
      {
        org_id: orgId,
        ...data,
      },
      { onConflict: 'org_id' }
    )
    .select(
      'walls_paint_id, walls_primer_id, ceiling_paint_id, ceiling_primer_id, trim_paint_id, trim_primer_id, override_labor_rate'
    )
    .single()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteDefaults(res.data as Unsafe | null)
}
