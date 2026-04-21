import {
  normalizeCompanyProfileSettings,
} from '@/lib/settings/companyProfile'
import type { CompanyProfileSettings } from '@/lib/settings/types'
import { supabaseAdmin } from '@/lib/server/org'

type Unsafe = Record<string, unknown>

export async function loadCompanyProfileSettings(orgId: string) {
  const res = await supabaseAdmin
    .from('company_profile_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeCompanyProfileSettings((res.data ?? null) as Unsafe | null)
}

export async function saveCompanyProfileSettings(orgId: string, data: CompanyProfileSettings) {
  const res = await supabaseAdmin
    .from('company_profile_settings')
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
  return normalizeCompanyProfileSettings(res.data as Unsafe | null)
}
