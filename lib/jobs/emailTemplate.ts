type TemplateVars = Record<string, string | null | undefined>

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

export function buildJobEmailTemplateVars(vars: JobEmailTemplateVarsInput) {
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
    reviewLink:
      vars.reviewLink ?? process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  })
}
