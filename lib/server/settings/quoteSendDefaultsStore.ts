import {
  normalizeQuoteSendDefaults,
} from '@/lib/settings/quoteSendDefaults'
import type { QuoteSendDefaults } from '@/lib/settings/types'
import { supabaseAdmin } from '@/lib/server/org'

type Unsafe = Record<string, unknown>

export async function loadQuoteSendDefaults(orgId: string) {
  const res = await supabaseAdmin
    .from('quote_send_defaults')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteSendDefaults((res.data ?? null) as Unsafe | null)
}

export async function saveQuoteSendDefaults(orgId: string, data: QuoteSendDefaults) {
  const res = await supabaseAdmin
    .from('quote_send_defaults')
    .upsert(
      {
        org_id: orgId,
        ...data,
      },
      { onConflict: 'org_id' }
    )
    .select('*')
    .single()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteSendDefaults(res.data as Unsafe | null)
}
