import {
  normalizeCustomerEstimateInput,
  type CustomerEstimateInput,
} from '@/lib/customer-estimates/inputNormalization'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function documentLabel(document: CustomerEstimateDocument) {
  return document.meta.flow_version === 'v2' || document.meta.flow_version === 'manual_pdf'
    ? 'Quote'
    : 'Estimate'
}

function isManualPdfQuote(document: CustomerEstimateDocument) {
  return document.meta.flow_version === 'manual_pdf'
}

export type CustomerSendReadinessIssueCode =
  | 'missing_customer_name'
  | 'missing_customer_email'
  | 'missing_company_contact_methods'
  | 'document_total_non_positive'
  | 'pricing_incomplete_zero_total'
  | 'document_company_placeholders'
  | 'document_payment_placeholders'
  | 'document_legal_placeholders'

export type CustomerSendReadinessIssue = {
  code: CustomerSendReadinessIssueCode
  message: string
  details?: string[]
}

export type CustomerSendReadinessResult = {
  blockers: CustomerSendReadinessIssue[]
  warnings: CustomerSendReadinessIssue[]
  readyToSend: boolean
}

export type CustomerSendReadinessInput = Pick<
  CustomerEstimateInput,
  | 'estimate'
  | 'job'
  | 'customer'
  | 'company'
  | 'inputs'
  | 'catalogs'
  | 'settings'
  | 'pricingSummary'
> & {
  document: CustomerEstimateDocument
}

function hasIncludedEstimateWork(input: CustomerSendReadinessInput) {
  const normalized = normalizeCustomerEstimateInput(input)
  return (
    normalized.roomWallScopes.some((row) => row.included) ||
    normalized.roomCeilingScopes.some((row) => row.included) ||
    normalized.roomTrimScopes.some((row) => row.included) ||
    normalized.roomDoorScopes.some((row) => row.included) ||
    normalized.roomDrywallScopes.some((row) => row.included) ||
    normalized.trimItems.length > 0 ||
    normalized.otherRows.length > 0
  )
}

function placeholderWarning(
  code:
    | 'document_company_placeholders'
    | 'document_payment_placeholders'
    | 'document_legal_placeholders',
  message: string,
  details: string[]
): CustomerSendReadinessIssue | null {
  if (details.length === 0) return null
  return {
    code,
    message,
    details,
  }
}

export function validateCustomerSendReadiness(
  input: CustomerSendReadinessInput
): CustomerSendReadinessResult {
  const blockers: CustomerSendReadinessIssue[] = []
  const warnings: CustomerSendReadinessIssue[] = []
  const label = documentLabel(input.document)
  const total = typeof input.document.total === 'number' && Number.isFinite(input.document.total)
    ? input.document.total
    : 0

  if (!asText(input.document.customer.name)) {
    blockers.push({
      code: 'missing_customer_name',
      message: 'Customer name is missing.',
    })
  }

  if (!asText(input.document.customer.email)) {
    blockers.push({
      code: 'missing_customer_email',
      message: 'Customer email is missing.',
    })
  }

  if (
    !asText(input.document.company.main_phone) &&
    !asText(input.document.company.business_email)
  ) {
    blockers.push({
      code: 'missing_company_contact_methods',
      message: 'Company phone or business email is missing.',
    })
  }

  if (total <= 0 && !isManualPdfQuote(input.document)) {
    blockers.push({
      code: 'document_total_non_positive',
      message:
        total === 0
          ? `${label} total is $0.`
          : `${label} total must be greater than $0.`,
    })
  }

  if (total === 0 && hasIncludedEstimateWork(input)) {
    blockers.push({
      code: 'pricing_incomplete_zero_total',
      message:
        `${label} includes priced scope inputs, but the total is still $0.`,
    })
  }

  const companyFieldWarnings = input.document.assembly_meta.missing_company_fields
    .filter((field) => field === 'business_name')
    .map((field) => {
      const message =
        field === 'business_name' ? 'Company name is missing.' : 'Company details are missing.'
      return {
        code: 'document_company_placeholders' as const,
        message,
        details: [field],
      }
    })
  warnings.push(...companyFieldWarnings)

  const companyWarning = placeholderWarning(
    'document_company_placeholders',
    'Company details still contain placeholder copy.',
    input.document.assembly_meta.missing_company_fields
      .filter((field) => field !== 'business_name')
      .map((field) => String(field).trim())
      .filter(Boolean)
  )
  if (companyWarning && companyFieldWarnings.length === 0) warnings.push(companyWarning)

  const paymentWarning = placeholderWarning(
    'document_payment_placeholders',
    'Payment terms still contain placeholder copy.',
    input.document.assembly_meta.missing_payment_fields.map((field) => String(field).trim()).filter(Boolean)
  )
  if (paymentWarning) warnings.push(paymentWarning)

  const legalWarning = placeholderWarning(
    'document_legal_placeholders',
    'Legal terms still contain placeholder copy.',
    input.document.assembly_meta.missing_legal_fields.map((field) => String(field).trim()).filter(Boolean)
  )
  if (legalWarning) warnings.push(legalWarning)

  return {
    blockers,
    warnings,
    readyToSend: blockers.length === 0,
  }
}
