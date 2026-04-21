import type { RatesFlagsCategoryKey } from '../../../types/estimator/ratesFlags'
import type { TemplateConstantRowRecord, TemplateConstantsRecord } from './categoryTypes.ts'

type SupabaseAdminClient = typeof import('../org.ts').supabaseAdmin

let supabaseAdminProvider: (() => Promise<unknown>) | null = null

export async function getSupabaseAdmin(): Promise<SupabaseAdminClient> {
  if (supabaseAdminProvider) {
    return (await supabaseAdminProvider()) as SupabaseAdminClient
  }
  const mod = await import('../org.ts')
  return mod.supabaseAdmin
}

export function setSupabaseAdminProvider(provider: (() => Promise<unknown>) | null) {
  supabaseAdminProvider = provider
}

export async function fetchTemplateState(orgId: string) {
  const supabaseAdmin = await getSupabaseAdmin()
  const templateRes = await supabaseAdmin
    .from('estimator_template_constants')
    .select('id, org_id, version, seeded_at')
    .eq('org_id', orgId)
    .maybeSingle()
  if (templateRes.error) throw new Error(templateRes.error.message)
  if (!templateRes.data) {
    return { template: null as TemplateConstantsRecord | null, rows: [] as TemplateConstantRowRecord[] }
  }

  const rowRes = await supabaseAdmin
    .from('estimator_template_constant_rows')
    .select(
      'id, org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json'
    )
    .eq('org_id', orgId)
    .eq('template_id', templateRes.data.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (rowRes.error) throw new Error(rowRes.error.message)

  return {
    template: templateRes.data as TemplateConstantsRecord,
    rows: (rowRes.data ?? []) as TemplateConstantRowRecord[],
  }
}

export async function ensureTemplateState(orgId: string) {
  const state = await fetchTemplateState(orgId)
  if (state.template) return state

  const supabaseAdmin = await getSupabaseAdmin()
  const createdTemplate = await supabaseAdmin
    .from('estimator_template_constants')
    .insert({
      org_id: orgId,
      version: 1,
      seeded_at: new Date().toISOString(),
    })
    .select('id, org_id, version, seeded_at')
    .single()
  if (createdTemplate.error) {
    const lowered = createdTemplate.error.message.toLowerCase()
    if (!(lowered.includes('duplicate') || lowered.includes('unique'))) {
      throw new Error(createdTemplate.error.message)
    }
    return fetchTemplateState(orgId)
  }

  return {
    template: createdTemplate.data as TemplateConstantsRecord,
    rows: [] as TemplateConstantRowRecord[],
  }
}

export async function bumpTemplateVersion(orgId: string, template: TemplateConstantsRecord) {
  const supabaseAdmin = await getSupabaseAdmin()
  const nextVersion = Math.max(1, Number(template.version || 0) + 1)
  const update = await supabaseAdmin
    .from('estimator_template_constants')
    .update({ version: nextVersion })
    .eq('org_id', orgId)
    .eq('id', template.id)
  if (update.error) throw new Error(update.error.message)
}

export async function getTemplateRowById(params: {
  orgId: string
  templateId: string
  categoryKey: RatesFlagsCategoryKey
  rowId: string
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  const rowRes = await supabaseAdmin
    .from('estimator_template_constant_rows')
    .select(
      'id, org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json'
    )
    .eq('org_id', params.orgId)
    .eq('template_id', params.templateId)
    .eq('category_key', params.categoryKey)
    .eq('row_id', params.rowId)
    .maybeSingle()
  if (rowRes.error) throw new Error(rowRes.error.message)
  return (rowRes.data ?? null) as TemplateConstantRowRecord | null
}
