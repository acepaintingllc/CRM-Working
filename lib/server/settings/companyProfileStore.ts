import {
  normalizeCompanyProfileSettings,
} from '../../settings/companyProfile.ts'
import type { CompanyProfileSettings } from '../../settings/types.ts'
import { supabaseAdmin } from '../org.ts'

type Unsafe = Record<string, unknown>

const companyProfileSelect = [
  'business_name',
  'timezone',
  'main_phone',
  'business_email',
  'address',
  'website',
  'sender_signature',
  'logo_url',
].join(',')

const orgFallbackSelect = [
  'name',
  'timezone',
  'main_phone',
  'business_email',
  'address',
  'website',
  'sender_signature',
  'logo_url',
].join(',')

function isMissingCompanyProfileTableError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === 'PGRST205' &&
    typeof error.message === 'string' &&
    error.message.includes('company_profile_settings')
  )
}

function normalizeOrgCompanyProfileSettings(row: Unsafe | null | undefined) {
  return normalizeCompanyProfileSettings({
    business_name: row?.name,
    timezone: row?.timezone,
    main_phone: row?.main_phone,
    business_email: row?.business_email,
    address: row?.address,
    website: row?.website,
    sender_signature: row?.sender_signature,
    logo_url: row?.logo_url,
  })
}

async function loadCompanyProfileSettingsFromOrg(orgId: string) {
  const res = await supabaseAdmin
    .from('orgs')
    .select(orgFallbackSelect)
    .eq('id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeOrgCompanyProfileSettings((res.data ?? null) as Unsafe | null)
}

async function saveCompanyProfileSettingsToOrg(orgId: string, data: CompanyProfileSettings) {
  const res = await supabaseAdmin
    .from('orgs')
    .update({
      name: data.business_name,
      timezone: data.timezone,
      main_phone: data.main_phone,
      business_email: data.business_email,
      address: data.address,
      website: data.website,
      sender_signature: data.sender_signature,
      logo_url: data.logo_url,
    })
    .eq('id', orgId)
    .select(orgFallbackSelect)
    .single()

  if (res.error) throw new Error(res.error.message)
  return normalizeOrgCompanyProfileSettings(res.data as unknown as Unsafe | null)
}

export async function loadCompanyProfileSettings(orgId: string) {
  const res = await supabaseAdmin
    .from('company_profile_settings')
    .select(companyProfileSelect)
    .eq('org_id', orgId)
    .maybeSingle()

  if (isMissingCompanyProfileTableError(res.error)) {
    return loadCompanyProfileSettingsFromOrg(orgId)
  }
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
    .select(companyProfileSelect)
    .single()

  if (isMissingCompanyProfileTableError(res.error)) {
    return saveCompanyProfileSettingsToOrg(orgId, data)
  }
  if (res.error) throw new Error(res.error.message)
  return normalizeCompanyProfileSettings(res.data as unknown as Unsafe | null)
}
