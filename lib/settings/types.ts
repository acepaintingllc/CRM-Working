export type CompanyProfileSettings = {
  business_name: string
  timezone: string
  main_phone: string
  business_email: string
  address: string
  website: string
  sender_signature: string
  logo_url: string
}

export type QuoteSendDefaults = {
  default_template_key: string
  quote_validity_days: number
  terms_text: string
}

export type QuoteDefaults = {
  walls_paint_id: string | null
  walls_primer_id: string | null
  ceiling_paint_id: string | null
  ceiling_primer_id: string | null
  trim_paint_id: string | null
  trim_primer_id: string | null
  override_labor_rate: number
}

export type SettingsApiError = {
  error: string
}

export type SettingsDataResponse<T> = {
  data: T
  meta?: Record<string, unknown>
}

export type SettingsMutationResponse<T> = {
  data: T
  notice?: string
}
