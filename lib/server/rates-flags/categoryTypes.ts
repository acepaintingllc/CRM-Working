import type {
  RatesFlagsActivationRequest,
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsColumnDef,
  RatesFlagsFieldDef,
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequest,
  RatesFlagsMutationValues,
  RatesFlagsRow,
} from '../../../types/estimator/ratesFlags'

export type StringRecord = Record<string, string>
export type PersistedValuesRecord = Record<string, string>

export type FieldConfig = RatesFlagsFieldDef & {
  headers: string[]
  writeDefault?: string | ((values: StringRecord) => string)
}

export type CategoryConfig<TKey extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey> = {
  key: TKey
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
  category_key: RatesFlagsEditableCategoryKey
  row_id: string
  display_name: string
  active: 'Y' | 'N'
  sort_order: number
  values_json: PersistedValuesRecord | null
}

export type CategoryMutationParams<TKey extends RatesFlagsEditableCategoryKey = RatesFlagsEditableCategoryKey> = {
  table: ConstantsTableDetailed
  config: CategoryConfig<TKey>
  request: Extract<RatesFlagsMutationRequest, { category: TKey }>
}

export type {
  RatesFlagsActivationRequest,
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsColumnDef,
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequest,
  RatesFlagsMutationValues,
  RatesFlagsRow,
}
