export type TemplateVars = Record<string, string | null | undefined>

export const DEFAULT_REVIEW_LINK = 'https://g.page/r/CXTTS4mREhqcEBM/review'

export type JobEmailTemplateVarsInput = {
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  jobTitle?: string | null
  estimateDate?: string | null
  scheduledDate?: string | null
  scheduledBlocks?: string | null
  estimateFileName?: string | null
  estimateFileLink?: string | null
  estimateFileNames?: string | null
  estimateFileLinks?: string | null
  reviewLink?: string | null
}

export type JobEmailTemplateDefaults = {
  reviewLink?: string | null
}

export type JobEmailTemplateEstimateFile = {
  id?: string | null
  name?: string | null
  filename?: string | null
  webViewLink?: string | null
}

export function applyTemplate(template: string, vars: TemplateVars) {
  let output = template
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value ?? '')
  }
  return output
}

export function withJobTemplateAliases(vars: TemplateVars) {
  return {
    ...vars,
    customer_name: vars.customerName,
    customer_email: vars.customerEmail,
    customer_phone: vars.customerPhone,
    customer_address: vars.customerAddress,
    job_title: vars.jobTitle,
    estimate_date: vars.estimateDate,
    scheduled_date: vars.scheduledDate,
    scheduled_blocks: vars.scheduledBlocks,
    estimate_file_name: vars.estimateFileName,
    estimate_file_link: vars.estimateFileLink,
    estimate_file_names: vars.estimateFileNames,
    estimate_file_links: vars.estimateFileLinks,
    review_link: vars.reviewLink,
  }
}

export function buildJobEmailTemplateVars(
  vars: JobEmailTemplateVarsInput,
  defaults: JobEmailTemplateDefaults = {}
) {
  return withJobTemplateAliases({
    customerName: vars.customerName ?? '',
    customerEmail: vars.customerEmail ?? '',
    customerPhone: vars.customerPhone ?? '',
    customerAddress: vars.customerAddress ?? '',
    jobTitle: vars.jobTitle ?? '',
    estimateDate: vars.estimateDate ?? '',
    scheduledDate: vars.scheduledDate ?? '',
    scheduledBlocks: vars.scheduledBlocks ?? '',
    estimateFileName: vars.estimateFileName ?? '',
    estimateFileLink: vars.estimateFileLink ?? '',
    estimateFileNames: vars.estimateFileNames ?? '',
    estimateFileLinks: vars.estimateFileLinks ?? '',
    reviewLink: vars.reviewLink ?? defaults.reviewLink ?? DEFAULT_REVIEW_LINK,
  })
}

export function formatJobTemplateDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function formatJobTemplateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (start && end) return `${formatJobTemplateDate(start)} - ${formatJobTemplateDate(end)}`
  if (start) return formatJobTemplateDate(start)
  if (end) return formatJobTemplateDate(end)
  return ''
}

export function buildEstimateFileTemplateVars(args: {
  estimateFiles?: JobEmailTemplateEstimateFile[]
  selectedEstimateFileIds?: string[]
}) {
  const estimateFiles = args.estimateFiles ?? []
  const selectedIds = args.selectedEstimateFileIds
  const selectedEstimateFiles =
    Array.isArray(selectedIds)
      ? selectedIds
          .map((id) => estimateFiles.find((file) => file.id === id) ?? null)
          .filter((file): file is JobEmailTemplateEstimateFile => Boolean(file))
      : estimateFiles
  const primaryEstimateFile = selectedEstimateFiles[0] ?? null

  return {
    estimateFileName: primaryEstimateFile?.name ?? primaryEstimateFile?.filename ?? '',
    estimateFileLink: primaryEstimateFile?.webViewLink ?? '',
    estimateFileNames: selectedEstimateFiles
      .map((file) => file.name ?? file.filename ?? '')
      .filter(Boolean)
      .join(', '),
    estimateFileLinks: selectedEstimateFiles
      .map((file) => file.webViewLink ?? '')
      .filter(Boolean)
      .join('\n'),
  }
}
