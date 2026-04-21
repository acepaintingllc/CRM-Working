import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsColumnDef,
  RatesFlagsFieldDef,
  RatesFlagsMutationRequest,
  RatesFlagsRow,
} from '../../../types/estimator/ratesFlags'

export type StringRecord = Record<string, string>

export type FieldConfig = RatesFlagsFieldDef & {
  headers: string[]
  writeDefault?: string | ((values: StringRecord) => string)
}

export type CategoryConfig = {
  key: RatesFlagsCategoryKey
  tab: RatesFlagsCategory['tab']
  group: RatesFlagsCategory['group']
  label: string
  tableTitles: string[]
  additionalTableTitles?: string[][]
  mergeAdditionalTableTitles?: boolean
  description: string
  columns: RatesFlagsColumnDef[]
  fields: FieldConfig[]
  rowFilter?: (row: StringRecord) => boolean
  toRow: (values: StringRecord, active: boolean) => RatesFlagsRow
}

export type ConstantsTableRow = {
  rowNumber: number
  values: StringRecord
}

export type ConstantsTableDetailed = {
  key: string
  title: string
  titleRow: number
  headerRow: number
  headers: string[]
  headerIndexes: number[]
  rows: ConstantsTableRow[]
}

export type MutationPlanResult =
  | {
      ok: true
      updates: {
        range: string
        values: (string | number | boolean | null)[][]
      }[]
    }
  | { ok: false; error: string; status: number }

export type TemplateConstantsRecord = {
  id: string
  org_id: string
  version: number
  seeded_at: string
}

export type TemplateConstantRowRecord = {
  id: string
  org_id: string
  template_id: string
  category_key: RatesFlagsCategoryKey
  row_id: string
  display_name: string
  active: 'Y' | 'N'
  sort_order: number
  values_json: Record<string, unknown> | null
}

export type CategoryMutationParams = {
  table: ConstantsTableDetailed
  config: CategoryConfig
  request: RatesFlagsMutationRequest
}

export type { RatesFlagsCategory, RatesFlagsCategoryKey, RatesFlagsColumnDef, RatesFlagsMutationRequest, RatesFlagsRow }
