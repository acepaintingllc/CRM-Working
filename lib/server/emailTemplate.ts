type TemplateVars = Record<string, string | null | undefined>;

export function applyTemplate(template: string, vars: TemplateVars) {
  let output = template;
  for (const [key, value] of Object.entries(vars)) {
    const safe = value ?? "";
    output = output.replaceAll(`{{${key}}}`, safe);
  }
  return output;
}

export function withTemplateAliases(vars: TemplateVars) {
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
  };
}
