import type { AcceptedEstimateOperationalSource } from './acceptedEstimateSource'

export type JobColorSelectionStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'needs_revision'

export type JobColorSelectionScopeKind =
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'cabinets'
  | 'other'

export type JobColorSelectionSurface = {
  key: string
  room_id: string | null
  room_display_name: string | null
  scope_kind: JobColorSelectionScopeKind
  scope_id: string | null
  scope_display_name: string | null
  surface_label: string
  paint_product_id: string | null
  paint_product_display_name: string | null
  quantity_label: string | null
  required: boolean
  position: number
}

export type JobColorSelectionSetRecord = {
  id: string
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  customer_id: string | null
  status: JobColorSelectionStatus
  revision_number: number
  title: string
  accepted_estimate_display_name: string | null
  accepted_total: number
  public_token_expires_at: string | null
  public_token_revoked_at: string | null
  submitted_at: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobColorSelectionRecord = {
  id: string
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  selection_set_id: string
  room_id: string | null
  room_display_name: string | null
  scope_kind: JobColorSelectionScopeKind
  scope_id: string | null
  scope_display_name: string | null
  surface_label: string | null
  paint_brand_id: string | null
  paint_brand_display_name: string | null
  color_catalog_id: string | null
  color_number: string | null
  color_name: string | null
  color_display_name: string | null
  sheen_id: string | null
  sheen_display_name: string | null
  paint_product_id: string | null
  paint_product_display_name: string | null
  quantity_label: string | null
  notes: string | null
  customer_notes: string | null
  status: JobColorSelectionStatus
  position: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobColorSelectionCompleteness = {
  required_count: number
  completed_count: number
  missing_surface_keys: string[]
  complete: boolean
}

export type JobColorCatalogOption = {
  id: string
  brand_id: string | null
  brand_name: string | null
  color_number: string | null
  color_name: string
  family: string | null
  hex: string | null
  lrv: number | null
  collection: string | null
  active: boolean
}

export type JobPaintSheenOption = {
  id: string
  sheen_name: string
  display_name: string
  active: boolean
}

export type JobColorSelectionsCatalog = {
  colors: JobColorCatalogOption[]
  sheens: JobPaintSheenOption[]
}

export type JobColorSelectionsReadModel = {
  source: Pick<AcceptedEstimateOperationalSource, 'job' | 'customer' | 'acceptance' | 'estimate' | 'totals'>
  selection_set: JobColorSelectionSetRecord | null
  public_access: {
    token: string | null
    url_path: string | null
    expires_at: string | null
  }
  surfaces: JobColorSelectionSurface[]
  selections: JobColorSelectionRecord[]
  catalog: JobColorSelectionsCatalog
  completeness: JobColorSelectionCompleteness
}

export type JobColorSelectionDraftItem = {
  room_id?: string | null
  room_display_name?: string | null
  scope_kind: JobColorSelectionScopeKind
  scope_id?: string | null
  scope_display_name?: string | null
  surface_label?: string | null
  paint_brand_id?: string | null
  paint_brand_display_name?: string | null
  color_catalog_id?: string | null
  color_number?: string | null
  color_name?: string | null
  color_display_name?: string | null
  sheen_id?: string | null
  sheen_display_name?: string | null
  paint_product_id?: string | null
  paint_product_display_name?: string | null
  quantity_label?: string | null
  notes?: string | null
  customer_notes?: string | null
  position?: number | null
}

export type JobColorSelectionsDraftInput = {
  selections: JobColorSelectionDraftItem[]
}
