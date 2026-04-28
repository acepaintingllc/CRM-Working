import { splitTermsText } from './presets.ts'
import type { CustomerEstimateSection, CustomerEstimateSectionKey } from './types.ts'
import {
  asText,
  cleanCustomerFacingText,
  listJoin,
  normalizeScopeText,
  sentenceCase,
  textJoin,
  uniqueText,
} from './buildShared.ts'
import type { ScopeBucket, ScopeBuckets } from './scopeExtraction.ts'

export function splitParagraphs(value: string) {
  return splitTermsText(value)
}

export function buildScopeText(params: {
  label: string
  fallbackTexts: string[]
  overrideText?: string
}) {
  const override = asText(params.overrideText)
  if (override) return override
  const fallback = uniqueText(params.fallbackTexts)
    .map((text) => cleanCustomerFacingText(text))
    .filter(Boolean)
    .join('\n')
  if (fallback) return fallback
  return `${params.label} is included in this quote.`
}

export function buildCustomerEstimateSections(params: {
  scoped: Record<CustomerEstimateSectionKey, ScopeBucket>
  overrides?: {
    scope_text_edits?: Partial<Record<CustomerEstimateSectionKey, string>>
  }
}): CustomerEstimateSection[] {
  const sectionDefinitions: Array<{
    key: CustomerEstimateSectionKey
    label: string
  }> = [
    { key: 'walls', label: 'Walls' },
    { key: 'ceilings', label: 'Ceilings' },
    { key: 'trim', label: 'Trim' },
    { key: 'doors', label: 'Doors' },
    { key: 'cabinets', label: 'Cabinets' },
    { key: 'other', label: 'Other' },
  ]

  return sectionDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    text: buildScopeText({
      label: definition.label === 'Other' ? 'Other work' : definition.label,
      fallbackTexts: params.scoped[definition.key].texts,
      overrideText: params.overrides?.scope_text_edits?.[definition.key],
    }),
    price: params.scoped[definition.key].price > 0 ? params.scoped[definition.key].price : null,
  }))
}

export function prepFragments(texts: string[]) {
  const joined = texts.join(' | ').toLowerCase()
  const parts: string[] = []
  if (joined.includes('drywall')) parts.push('repair minor drywall issues where needed')
  if (joined.includes('wallpaper')) parts.push('remove wallpaper')
  if (joined.includes('stain')) parts.push('stain block repaired or discolored areas')
  if (joined.includes('major special prep') || joined.includes('special prep')) {
    parts.push('handle special prep as needed')
  }
  if (parts.length === 0 && texts.some((text) => !!text.trim())) {
    parts.push(...texts.filter(Boolean).map((text) => sentenceCase(text)))
  }
  return uniqueText(parts)
}

export function buildSentence(params: {
  bucket: ScopeBucket
  scopeWord: string
}) {
  const rooms = uniqueText(params.bucket.rooms)
  const paintProducts = uniqueText(params.bucket.paintProducts)
  const subjectLabels = uniqueText(params.bucket.subjectLabels)
  const notes = uniqueText(params.bucket.notes)
  const coatCount = params.bucket.coats.find((value) => Number.isFinite(value)) ?? null
  const primeText = params.bucket.primeModes.includes('FULL')
    ? ', with full prime'
    : ''
  const prepActions = params.bucket.primeModes.includes('SPOT')
    ? uniqueText([...notes, 'spot prime as needed'])
    : notes
  const prep = prepActions.length > 0 ? `Prep, ${listJoin(prepActions)}, and` : 'Prep and'
  const coatText = coatCount != null ? `paint ${coatCount} coats` : 'paint'
  const subjectText = subjectLabels.length > 0 ? `for ${listJoin(subjectLabels)}` : ''
  const roomText = rooms.length > 0 ? `in ${listJoin(rooms)}` : ''
  const productText = paintProducts.length > 0 ? `, using ${listJoin(paintProducts)}` : ''
  return normalizeScopeText(
    cleanCustomerFacingText(
      textJoin([prep, coatText, params.scopeWord, subjectText, roomText, productText, primeText])
    )
  )
}

export function finalizeScopeBuckets(sectionBuckets: ScopeBuckets) {
  const finalizeBucket = (scope: CustomerEstimateSectionKey, scopeWord: string) => {
    const bucket = sectionBuckets[scope]
    if (bucket.price <= 0) {
      sectionBuckets[scope] = { ...bucket, texts: [] }
      return
    }

    const sentence = buildSentence({ bucket, scopeWord })
    if (sentence) {
      sectionBuckets[scope] = { ...bucket, texts: [sentence] }
      return
    }

    sectionBuckets[scope] = {
      ...bucket,
      texts: uniqueText(bucket.texts)
        .map((text) => cleanCustomerFacingText(text))
        .filter(Boolean),
    }
  }

  finalizeBucket('walls', 'on walls')
  finalizeBucket('ceilings', 'on ceilings')
  finalizeBucket('trim', 'on trim')
  finalizeBucket('doors', 'on doors')
  finalizeBucket('cabinets', 'on cabinets')
  sectionBuckets.other = {
    ...sectionBuckets.other,
    texts:
      sectionBuckets.other.price > 0
        ? uniqueText(sectionBuckets.other.texts)
            .map((text) => cleanCustomerFacingText(text))
            .filter(Boolean)
        : [],
  }

  return sectionBuckets
}
