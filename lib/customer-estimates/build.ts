import {
  normalizeCustomerEstimateInput,
  type CustomerEstimateInput,
  type CustomerEstimateCatalogs,
} from './inputNormalization.ts'
import type {
  CompanyProfile,
  CustomerEstimatePricingSummary,
  CustomerEstimateSectionKey,
} from './types.ts'
import type { QuoteTermsSections } from './termsDefaults.ts'
import { extractScopeBuckets } from './scopeExtraction.ts'
import { finalizeScopeBuckets } from './textGeneration.ts'
import { assembleCustomerEstimateBuild } from './documentAssembly.ts'

export type { CustomerEstimateInput } from './inputNormalization.ts'
export { buildEstimatePublicSnapshot } from './publicSnapshot.ts'

type CustomerEstimateInputRow = object

export interface CustomerEstimateTypedInput {
  estimate: CustomerEstimateInputRow
  job: CustomerEstimateInputRow
  customer?: CustomerEstimateInputRow | null
  company: CompanyProfile
  inputs: {
    rooms?: CustomerEstimateInputRow[]
    room_wall_scopes?: CustomerEstimateInputRow[]
    room_ceiling_scopes?: CustomerEstimateInputRow[]
    room_trim_scopes?: CustomerEstimateInputRow[]
    room_door_scopes?: CustomerEstimateInputRow[]
    drywall_repairs?: CustomerEstimateInputRow[]
    access_fees?: CustomerEstimateInputRow[]
    prejob?: CustomerEstimateInputRow[]
    trim_items?: CustomerEstimateInputRow[]
    other?: CustomerEstimateInputRow[]
    jobsettings?: CustomerEstimateInputRow | null
    org_defaults?: CustomerEstimateInputRow | null
  }
  catalogs?: CustomerEstimateCatalogs | null
  settings?: {
    quote_validity_days?: number | null
    terms_font_size?: number | null
    terms_text?: string | null
    terms_sections?: QuoteTermsSections | null
    default_template_key?: string | null
  }
  pricingSummary?: CustomerEstimatePricingSummary | null
  overrides?: {
    title?: string
    intro_paragraph?: string
    closing_paragraph?: string
    scope_text_edits?: Partial<Record<CustomerEstimateSectionKey, string>>
    quote_validity_days?: number | string | null
    deposit_language?: string
    card_fee_note?: string
  }
  publicMeta?: {
    status?: string
    sent_at?: string | null
    viewed_at?: string | null
    accepted_at?: string | null
    declined_at?: string | null
    public_token?: string | null
  }
}

export function buildCustomerEstimateDocument(params: CustomerEstimateInput): ReturnType<typeof assembleCustomerEstimateBuild>
export function buildCustomerEstimateDocument(
  params: CustomerEstimateTypedInput
): ReturnType<typeof assembleCustomerEstimateBuild>
export function buildCustomerEstimateDocument(
  params: CustomerEstimateInput | CustomerEstimateTypedInput
) {
  const normalized = normalizeCustomerEstimateInput(params as CustomerEstimateInput)
  const scoped = finalizeScopeBuckets(
    extractScopeBuckets({
      rooms: normalized.rooms,
      roomWallScopes: normalized.roomWallScopes,
      roomCeilingScopes: normalized.roomCeilingScopes,
      roomTrimScopes: normalized.roomTrimScopes,
      roomDoorScopes: normalized.roomDoorScopes,
      roomDrywallScopes: normalized.roomDrywallScopes,
      trimItems: normalized.trimItems,
      otherRows: normalized.otherRows,
      paintCatalogRows: normalized.paintCatalogRows,
      trimCatalogRows: normalized.trimCatalogRows,
      jobsettings: normalized.jobsettings,
    })
  )

  return assembleCustomerEstimateBuild({
    normalized,
    scoped,
  })
}
