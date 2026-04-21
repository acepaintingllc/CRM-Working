export type TemplatePreset = {
  key: string
  label: string
  subject: string
  body: string
}

export const templatePresets: TemplatePreset[] = [
  {
    key: 'default',
    label: 'Default',
    subject: 'Your quote is ready',
    body:
      'Hello,\n\nYour quote is ready. Please review the secure link below and let us know if you have any questions.\n\nThank you.',
  },
  {
    key: 'concise',
    label: 'Concise',
    subject: 'Attached: quote for your project',
    body: 'Hello,\n\nYour quote is ready for review.\n\nThank you.',
  },
  {
    key: 'friendly',
    label: 'Friendly',
    subject: 'Here is your quote',
    body:
      'Hello,\n\nIt was great talking with you. Your quote is ready to review at the secure link below.\n\nPlease reach out if you want to discuss anything before you accept.',
  },
]

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function splitTermsText(value: string) {
  return asText(value)
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function buildDefaultTermsText(params: {
  quoteValidityDays: number
  estimateDate: string
  depositLanguage: string
  cardFeeNote: string
}) {
  return [
    `This quote is valid for ${params.quoteValidityDays} days from ${params.estimateDate || 'the date shown above'}.`,
    params.depositLanguage,
    params.cardFeeNote,
    'Acceptance confirms the scope, pricing, schedule, and terms shown on this page.',
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
}
