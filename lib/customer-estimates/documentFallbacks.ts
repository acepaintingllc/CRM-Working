// Temporary customer-facing placeholders live here so renderer code stays policy-free.
// Replace these with org-configurable settings when those sources are available.

export const DOCUMENT_PLACEHOLDERS = {
  companyName: '[Company name missing]',
  companyPhone: '[Company phone missing]',
  companyEmail: '[Company email missing]',
  companyAddress: '[Company address missing]',
  companyWebsite: '[Company website missing]',
  customerName: '[Customer name missing]',
  depositTerms: '[Deposit terms missing]',
  cardFeeNote: '[Card fee note missing]',
  insuranceStatement: '[Insurance statement missing]',
} as const

export const DEFAULT_DOCUMENT_LABEL = 'QUOTE'
export const DEFAULT_QUOTE_FOOTER_NOTE =
  'This quote is subject to the terms and conditions on page 2.'

export const DEFAULT_INCLUDED_PREPARATION = [
  {
    key: 'walls',
    title: 'Walls',
    text:
      'Fill minor nail holes, patch minor surface imperfections, sand patched areas, and spot-prime repairs as needed.',
  },
  {
    key: 'ceilings',
    title: 'Ceilings',
    text:
      'Fill minor surface imperfections, sand patched areas, and spot-prime repairs as needed.',
  },
  {
    key: 'trim',
    title: 'Trim',
    text:
      'Clean and degrease, caulk gaps, fill minor holes, sand, and spot-prime bare or repaired areas as needed.',
  },
] as const

export const DEFAULT_CUSTOMER_RESPONSIBILITIES = [
  'Customer is responsible for removing fragile, valuable, or small personal items from work areas prior to the start of work.',
  'Customer is also responsible for removing wall hangings, artwork, televisions, curtains, and other mounted or decorative items unless otherwise agreed.',
  'Moving heavy furniture is not included unless specifically stated in this quote.',
]

export const DEFAULT_EXCLUSIONS = [
  'This quote includes only the specific walls, ceilings, trim, doors, closets, and other areas identified in the scope above.',
  'Any items or areas not specifically listed are excluded unless otherwise noted.',
  'Major drywall or plaster repair, water-damage repair, and wallpaper removal are not included unless specifically stated.',
]

export const DEFAULT_SCOPE_CHANGE_TERMS = [
  'Any work requested outside the scope of this quote will be discussed and approved before the work is performed.',
  'Additional labor and materials will be billed separately.',
  'Additional colors beyond the original scope may affect price.',
]

export const DEFAULT_THANK_YOU = [
  'Thank you for the opportunity to earn your business.',
]
