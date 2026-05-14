import { ensureAssembledCustomerEstimateDocument } from '@/lib/customer-estimates/assemble'
import type {
  BuiltCustomerEstimateDocument,
  CompanyProfile,
  CustomerEstimateCustomer,
} from '@/lib/customer-estimates/types'
import { defaultQuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import { deleteDriveFile, uploadDriveFile } from '@/lib/server/googleDrive'
import { supabaseAdmin } from '@/lib/server/org'
import { createEstimateCollectionVersion } from '@/lib/server/estimate-collection/service'
import { loadCompanyProfileSettings } from '@/lib/server/settings/companyProfileStore'
import { loadQuoteSendDefaults } from '@/lib/server/settings/quoteSendDefaultsStore'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
  type CustomerSendDraft,
  type CustomerSendOperationalSnapshot,
  type CustomerSendPersistedPdf,
  type EstimateCustomerSendEstimateRow,
  type EstimateTemplateSettingsRow,
} from '@/lib/server/customer-send/types'
import { createCustomerSendUploadedPdfDraft } from '@/lib/server/customer-send/service'

export type ManualQuotePdfUploadFile = {
  buffer: ArrayBuffer
  originalName: string
  mimeType: string
  sizeBytes: number
}

export type ManualQuotePdfUploadResult = {
  estimate_id: string
  send_url: string
  drive_file: {
    id: string
    name: string
    webViewLink: string | null
  }
}

type JobCustomerRow = {
  id: string
  title: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  customer_street: string | null
  customer_city: string | null
  customer_state: string | null
  customer_zip: string | null
}

const MAX_MANUAL_QUOTE_PDF_BYTES = 25 * 1024 * 1024

const DEFAULT_COMPANY: CompanyProfile = {
  business_name: '',
  timezone: 'America/Chicago',
  main_phone: '',
  business_email: '',
  address: '',
  website: '',
  sender_signature: '',
  logo_url: '',
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function sanitizeFilename(value: string) {
  return asText(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160)
}

function manualQuoteTitle(job: JobCustomerRow, fileName: string) {
  return asText(job.title) || asText(fileName).replace(/\.pdf$/i, '') || 'Manual PDF Quote'
}

function readDriveEstimatesFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID
  return typeof folderId === 'string' && folderId.trim() ? folderId.trim() : null
}

function validatePdfFile(file: ManualQuotePdfUploadFile): ServiceResult<null> {
  if (!file.sizeBytes || file.sizeBytes <= 0) {
    return errorResult('invalid_input', 'Upload a PDF before continuing.')
  }
  if (file.sizeBytes > MAX_MANUAL_QUOTE_PDF_BYTES) {
    return errorResult('invalid_input', 'PDF must be 25 MB or smaller.')
  }
  const fileName = asText(file.originalName)
  const mimeType = asText(file.mimeType).toLowerCase()
  if (mimeType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
    return errorResult('invalid_input', 'Upload a PDF file.')
  }
  return okResult(null)
}

async function loadJobCustomer(orgId: string, jobId: string): Promise<ServiceResult<JobCustomerRow>> {
  const result = await supabaseAdmin
    .from('jobs')
    .select(
      [
        'id',
        'title',
        'customer_id',
        'customers(name,email,phone,address,street,city,state,zip)',
      ].join(',')
    )
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (result.error) return errorResult('server_error', result.error.message)
  if (!result.data) return errorResult('not_found', 'Job not found.')

  const row = result.data as {
    id?: unknown
    title?: unknown
    customer_id?: unknown
    customers?: Record<string, unknown> | Record<string, unknown>[] | null
  }
  const customer = Array.isArray(row.customers) ? row.customers[0] ?? {} : row.customers ?? {}
  const customerId = asText(row.customer_id)
  if (!customerId) {
    return errorResult('invalid_input', 'Assign a customer to this job before uploading a quote PDF.')
  }

  return okResult({
    id: asText(row.id),
    title: asText(row.title) || null,
    customer_id: customerId,
    customer_name: asText(customer.name) || null,
    customer_email: asText(customer.email) || null,
    customer_phone: asText(customer.phone) || null,
    customer_address: asText(customer.address) || null,
    customer_street: asText(customer.street) || null,
    customer_city: asText(customer.city) || null,
    customer_state: asText(customer.state) || null,
    customer_zip: asText(customer.zip) || null,
  })
}

async function deleteCreatedEstimate(orgId: string, estimateId: string) {
  await supabaseAdmin
    .from('estimates')
    .delete()
    .eq('org_id', orgId)
    .eq('id', estimateId)
}

function buildCustomer(row: JobCustomerRow): CustomerEstimateCustomer {
  return {
    name: row.customer_name ?? '',
    email: row.customer_email ?? '',
    phone: row.customer_phone ?? '',
    address: row.customer_address ?? '',
    street: row.customer_street ?? '',
    city: row.customer_city ?? '',
    state: row.customer_state ?? '',
    zip: row.customer_zip ?? '',
  }
}

function buildManualPdfDraft(params: {
  title: string
  customer: CustomerEstimateCustomer
  company: CompanyProfile
  quoteValidityDays: number
}): CustomerSendDraft {
  const customerName = asText(params.customer.name) || 'there'
  const businessName = asText(params.company.business_name) || 'ACE Painting'
  return {
    to_email: asText(params.customer.email),
    cc_email: '',
    bcc_email: asText(params.company.business_email),
    subject: `${params.title} from ${businessName}`,
    body: `Hello ${customerName},\n\nYour quote is ready for review.\n\nThank you.`,
    template_key: 'default',
    title: params.title,
    intro_paragraph: '',
    closing_paragraph: '',
    terms_text: '',
    scope_text_edits: {},
    quote_validity_days: params.quoteValidityDays,
    deposit_language: '',
    card_fee_note: '',
  }
}

function buildManualPdfDocument(params: {
  estimateId: string
  estimateName: string
  title: string
  company: CompanyProfile
  customer: CustomerEstimateCustomer
  quoteValidityDays: number
}) {
  const now = new Date().toISOString()
  const document: BuiltCustomerEstimateDocument = {
    meta: {
      estimate_id: params.estimateId,
      version_name: params.estimateName,
      version_state: 'draft',
      flow_version: 'manual_pdf',
      title: params.title,
      quote_date: now.slice(0, 10),
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'draft',
      public_token: null,
    },
    company: params.company,
    customer: params.customer,
    intro_paragraph: 'Please review the attached PDF quote.',
    closing_paragraph: 'You can accept this quote using the signature form below.',
    quote_validity_days: params.quoteValidityDays,
    deposit_language: '',
    card_fee_note: '',
    quote_rows: [
      {
        key: 'other',
        label: 'Uploaded PDF quote',
        description: 'The quote details are included in the attached PDF.',
        price: 0,
      },
    ],
    scopes: [
      {
        key: 'other',
        label: 'Uploaded PDF quote',
        text: 'The quote details are included in the attached PDF.',
        price: null,
      },
    ],
    total: null,
    terms: [],
    terms_sections: defaultQuoteTermsSections,
    source_meta: {
      company: {
        business_name: Boolean(asText(params.company.business_name)),
        main_phone: Boolean(asText(params.company.main_phone)),
        business_email: Boolean(asText(params.company.business_email)),
        address: Boolean(asText(params.company.address)),
        website: Boolean(asText(params.company.website)),
        sender_signature: Boolean(asText(params.company.sender_signature)),
        logo_url: Boolean(asText(params.company.logo_url)),
      },
      settings: {
        quote_validity_days: true,
        terms_text: false,
        terms_sections: true,
      },
      overrides: {
        title: true,
        intro_paragraph: true,
        closing_paragraph: true,
        deposit_language: false,
        card_fee_note: false,
      },
    },
  }

  return ensureAssembledCustomerEstimateDocument(document)
}

function buildManualPdfOperationalSnapshot(params: {
  estimate: EstimateCustomerSendEstimateRow
}): CustomerSendOperationalSnapshot {
  return {
    artifact_kind: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
    artifact_version: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
    source_estimate_updated_at: asText(params.estimate.updated_at),
    estimate_response: {
      estimate: params.estimate,
      inputs: {
        rooms: [],
        room_wall_scopes: [],
        segments: [],
        wall_segments: [],
        ceiling_segments: [],
        room_ceiling_scopes: [],
        ceiling_scope_segments: [],
        room_trim_scopes: [],
        room_door_scopes: [],
        drywall_repairs: [],
        access_fees: [],
        prejob: [],
        trim_items: [],
        other: [],
        jobsettings: {},
        org_defaults: {} as EstimateTemplateSettingsRow,
      },
      wall_calculations: { scopes: [] },
      ceiling_calculations: { scopes: [] },
      trim_calculations: { scopes: [] },
      door_calculations: { scopes: [] },
      drywall_calculations: { scopes: [] },
      pricing_summary: {
        finalTotal: null,
        effectiveLaborHours: 0,
        rawLaborHours: 0,
        supplyCost: 0,
        paintMaterialCost: 0,
        primerMaterialCost: 0,
        sharedAccessCost: 0,
      },
    },
  }
}

export async function uploadManualQuotePdf(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
  file: ManualQuotePdfUploadFile
}): Promise<ServiceResult<ManualQuotePdfUploadResult>> {
  const validFile = validatePdfFile(params.file)
  if (!validFile.ok) return validFile

  const folderId = readDriveEstimatesFolderId()
  if (!folderId) {
    return errorResult('server_error', 'Google Drive estimates folder is not configured.')
  }

  const jobResult = await loadJobCustomer(params.orgId, params.jobId)
  if (!jobResult.ok) return jobResult

  const job = jobResult.data
  const safeFileName = sanitizeFilename(params.file.originalName) || 'Manual-Quote.pdf'
  const title = manualQuoteTitle(job, safeFileName)
  const company = (await loadCompanyProfileSettings(params.orgId).catch(() => null)) ?? DEFAULT_COMPANY
  const quoteDefaults = await loadQuoteSendDefaults(params.orgId).catch(() => null)
  const quoteValidityDays = quoteDefaults?.quote_validity_days ?? 90

  const estimateResult = await createEstimateCollectionVersion({
    orgId: params.orgId,
    userId: params.userId,
    body: {
      job_id: params.jobId,
      customer_id: job.customer_id,
      version_kind: 'standard',
      version_name: `Manual PDF Quote - ${title}`,
    },
    copy: {
      createdNotice: 'Manual PDF quote created.',
      defaultVersionLabel: 'Manual PDF Quote',
    },
  })
  if (!estimateResult.ok) return estimateResult

  const driveUpload = await uploadDriveFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    folderId,
    name: safeFileName,
    mimeType: 'application/pdf',
    data: Buffer.from(params.file.buffer),
  })
  if ('error' in driveUpload) {
    await deleteCreatedEstimate(params.orgId, estimateResult.data.id)
    return errorResult('server_error', driveUpload.error ?? 'Failed to upload quote PDF.')
  }

  const customer = buildCustomer(job)
  const draft = buildManualPdfDraft({
    title,
    customer,
    company,
    quoteValidityDays,
  })
  const document = buildManualPdfDocument({
    estimateId: estimateResult.data.id,
    estimateName: estimateResult.data.estimate.version_name ?? title,
    title,
    company,
    customer,
    quoteValidityDays,
  })
  const pdf: CustomerSendPersistedPdf = {
    drive_file_id: driveUpload.file.id,
    drive_file_name: driveUpload.file.name,
    drive_web_view_link: driveUpload.file.webViewLink ?? null,
    filename: driveUpload.file.name,
    mime_type: 'application/pdf',
    saved_at: new Date().toISOString(),
  }

  const publicVersion = await createCustomerSendUploadedPdfDraft({
    orgId: params.orgId,
    estimateId: estimateResult.data.id,
    customerId: asText(job.customer_id),
    userId: params.userId,
    draft,
    document,
    pdf,
    operationalSnapshot: buildManualPdfOperationalSnapshot({
      estimate: estimateResult.data.estimate as EstimateCustomerSendEstimateRow,
    }),
  })

  if (!publicVersion.ok) {
    await deleteDriveFile({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      fileId: driveUpload.file.id,
    })
    await deleteCreatedEstimate(params.orgId, estimateResult.data.id)
    return publicVersion
  }

  return okResult({
    estimate_id: estimateResult.data.id,
    send_url: `/crm/quotes/${encodeURIComponent(estimateResult.data.id)}/send?mode=uploaded-pdf`,
    drive_file: {
      id: driveUpload.file.id,
      name: driveUpload.file.name,
      webViewLink: driveUpload.file.webViewLink ?? null,
    },
  })
}
