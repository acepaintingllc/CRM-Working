import type { AcceptedEstimateOperationalSource } from './acceptedEstimateSource'

export type JobInvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

export type JobInvoiceMoneyInput = {
  credit_total: number
  payment_total: number
  deposit_total: number
  tax_rate: number
  tax_total: number | null
}

export type JobInvoiceGenerateInput = JobInvoiceMoneyInput & {
  invoice_number: string | null
  payment_terms: string | null
  due_date: string | null
  memo: string | null
}

export type JobInvoicePatchInput = Partial<JobInvoiceGenerateInput> & {
  status?: Extract<JobInvoiceStatus, 'paid'> | null
}

export type JobInvoiceChangeOrderDelta = {
  id: string
  change_order_number: string | null
  title: string | null
  description: string | null
  delta_total: number
  accepted_at: string | null
}

export type JobInvoiceSourceSummary = {
  source_kind: 'accepted_estimate_invoice'
  source_version: 1
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  accepted_public_version_id: string
  accepted_change_order_ids: string[]
  accepted_change_order_total: number
  generated_at: string
}

export type JobInvoiceDocument = {
  kind: 'job_invoice'
  version: 1
  generated_at: string
  title: string
  revision_number: number
  status: JobInvoiceStatus
  invoice_number: string | null
  payment_terms: string | null
  due_date: string | null
  source: JobInvoiceSourceSummary
  customer: AcceptedEstimateOperationalSource['customer']
  job: AcceptedEstimateOperationalSource['job']
  estimate: AcceptedEstimateOperationalSource['estimate']
  acceptance: AcceptedEstimateOperationalSource['acceptance']
  totals: {
    accepted_quote_total: number
    accepted_change_order_total: number
    taxable_subtotal: number
    tax_rate: number
    tax_total: number
    invoice_total: number
    credit_total: number
    payment_total: number
    deposit_total: number
    balance_due: number
  }
  notes: {
    memo: string | null
    accepted_estimate_notes: AcceptedEstimateOperationalSource['notes']
  }
  change_order_deltas: JobInvoiceChangeOrderDelta[]
}

export type JobInvoiceRow = {
  id: string
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  invoice_number: string | null
  revision_number: number
  status: JobInvoiceStatus
  title: string
  accepted_estimate_display_name: string | null
  customer_display_name: string | null
  job_display_name: string | null
  accepted_quote_total: number
  accepted_change_order_total: number
  taxable_subtotal: number
  tax_rate: number
  tax_total: number
  payment_total: number
  deposit_total: number
  credit_total: number
  invoice_total: number
  balance_due: number
  payment_terms: string | null
  due_date: string | null
  document_json: JobInvoiceDocument
  generated_snapshot_json?: JobInvoiceDocument
  source_summary_json: JobInvoiceSourceSummary
  generated_at: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobInvoiceReadModel = {
  current: JobInvoiceRow | null
}
