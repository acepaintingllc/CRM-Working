import { buildDefaultTermsText } from './presets.ts'
import {
  asText,
  formatAddressFromParts,
  formatHumanDate,
  round2,
} from './buildShared.ts'
import type {
  BuiltCustomerEstimateDocument,
  CustomerEstimateCustomer,
  CustomerEstimateQuoteRow,
} from './types.ts'
import type {
  NormalizedCustomerEstimateInput,
  NormalizedCustomerRecord,
  NormalizedJobRecord,
} from './inputNormalization.ts'
import { buildCustomerEstimateSections, splitParagraphs } from './textGeneration.ts'
import { trimCategory, type ScopeBucket, type ScopeBuckets } from './scopeExtraction.ts'
import { normalizeQuoteTermsSections } from './termsDefaults.ts'
import {
  allocateHiddenCustomerFees,
  type CustomerVisibleAllocationRow,
  type CustomerVisibleAllocationScopeKey,
  type HiddenCustomerFee,
} from './hiddenFeeAllocation.ts'

export function buildCustomerProfile(params: {
  customer?: NormalizedCustomerRecord | null
  job: NormalizedJobRecord
}): CustomerEstimateCustomer {
  const customer = params.customer ?? null
  const job = params.job
  const address = formatAddressFromParts({
    address: asText(customer?.address || job.customer_address),
    street: asText(customer?.street),
    city: asText(customer?.city),
    state: asText(customer?.state),
    zip: asText(customer?.zip),
  })
  return {
    name: asText(customer?.name || job.customer_name),
    email: asText(customer?.email || job.customer_email),
    phone: asText(customer?.phone || job.customer_phone),
    address,
    street: asText(customer?.street),
    city: asText(customer?.city),
    state: asText(customer?.state),
    zip: asText(customer?.zip),
  }
}

export function assembleCustomerEstimateBuild(params: {
  normalized: NormalizedCustomerEstimateInput
  scoped: ScopeBuckets
}): BuiltCustomerEstimateDocument {
  const { normalized, scoped } = params
  const estimate = normalized.estimate
  const job = normalized.job
  const total = normalized.pricingSummary?.finalTotal ?? null
  const versionName = asText(estimate.version_name) || 'Quote'
  const flowVersion = 'v2'
  const status = asText(normalized.publicMeta?.status) || asText(estimate.version_state) || 'draft'
  const title = normalized.overrides?.title?.trim() || versionName
  const estimateDate = asText(job.estimate_date || estimate.created_at || estimate.updated_at)
  const intro =
    normalized.overrides?.intro_paragraph?.trim() ||
    `Thank you for the opportunity to prepare this quote for ${asText(job.customer_name) || 'your project'}.`
  const closing =
    normalized.overrides?.closing_paragraph?.trim() ||
    'Please review the quote below. If everything looks right, you can accept it directly from the secure link.'
  const quoteValidityDays = resolveQuoteValidityDays(
    normalized.overrides?.quote_validity_days,
    normalized.settings?.quote_validity_days
  )
  const depositLanguage =
    normalized.overrides?.deposit_language?.trim() ||
    'A deposit may be required for scheduling or special-order materials.'
  const cardFeeNote =
    normalized.overrides?.card_fee_note?.trim() ||
    'Credit card payments are subject to a processing fee.'
  const termsText = normalized.settings?.terms_text?.trim() || ''
  const termsSections = normalized.settings?.terms_sections
    ? normalizeQuoteTermsSections(normalized.settings.terms_sections)
    : null
  const terms = splitParagraphs(
    termsText ||
      buildDefaultTermsText({
        quoteValidityDays,
        estimateDate,
        depositLanguage,
        cardFeeNote,
      })
  )

  const allocatedScoped = applyHiddenFeeAllocation({
    normalized,
    scoped,
  })
  const sections = buildCustomerEstimateSections({
    scoped: allocatedScoped,
    overrides: normalized.overrides,
  }).filter((section) => section.price != null && section.text.trim())
  const customer = buildCustomerProfile({ customer: normalized.customer, job })
  const fixedPriceSections = sections.filter((section) => section.key === 'other')
  const adjustableSections = sections.filter((section) => section.key !== 'other')
  const fixedPriceTotal = round2(fixedPriceSections.reduce((sum, section) => sum + (section.price ?? 0), 0))
  const adjustableTarget = total == null ? null : Math.max(0, round2(total - fixedPriceTotal))
  const quoteRows: CustomerEstimateQuoteRow[] = [
    ...reconcileCurrencyRows(
      adjustableSections.map((section) => ({
        key: section.key,
        label: section.label,
        description: section.text.trim(),
        price: section.price ?? 0,
      })),
      adjustableTarget
    ),
    ...reconcileCurrencyRows(
      fixedPriceSections.map((section) => ({
        key: section.key,
        label: section.label,
        description: section.text.trim(),
        price: section.price ?? 0,
      })),
      fixedPriceTotal
    ),
  ]
  const computedTotal = round2(total ?? quoteRows.reduce((sum, section) => sum + section.price, 0))

  return {
    meta: {
      estimate_id: asText(estimate.id),
      version_name: versionName,
      version_state: asText(estimate.version_state) || 'draft',
      flow_version: flowVersion,
      title,
      quote_date: formatHumanDate(estimateDate),
      sent_at: normalized.publicMeta?.sent_at ?? null,
      viewed_at: normalized.publicMeta?.viewed_at ?? null,
      accepted_at: normalized.publicMeta?.accepted_at ?? null,
      declined_at: normalized.publicMeta?.declined_at ?? null,
      status,
      public_token: normalized.publicMeta?.public_token ?? null,
    },
    company: normalized.company,
    customer,
    intro_paragraph: intro,
    closing_paragraph: closing,
    quote_validity_days: quoteValidityDays,
    deposit_language: depositLanguage,
    card_fee_note: cardFeeNote,
    quote_rows: quoteRows,
    scopes: sections,
    total: computedTotal,
    terms,
    terms_sections: termsSections,
    source_meta: {
      company: {
        business_name: !!asText(normalized.company.business_name),
        main_phone: !!asText(normalized.company.main_phone),
        business_email: !!asText(normalized.company.business_email),
        address: !!asText(normalized.company.address),
        website: !!asText(normalized.company.website),
        sender_signature: !!asText(normalized.company.sender_signature),
        logo_url: !!asText(normalized.company.logo_url),
      },
      settings: {
        quote_validity_days:
          normalized.overrides?.quote_validity_days != null ||
          normalized.settings?.quote_validity_days != null,
        terms_text: !!normalized.settings?.terms_text?.trim(),
        terms_sections: !!termsSections,
      },
      overrides: {
        title: !!normalized.overrides?.title?.trim(),
        intro_paragraph: !!normalized.overrides?.intro_paragraph?.trim(),
        closing_paragraph: !!normalized.overrides?.closing_paragraph?.trim(),
        deposit_language: !!normalized.overrides?.deposit_language?.trim(),
        card_fee_note: !!normalized.overrides?.card_fee_note?.trim(),
      },
    },
  }
}

function reconcileCurrencyRows<T extends { price: number }>(
  rows: T[],
  targetTotal: number | null
): T[] {
  const normalized = rows.map((row) => ({ ...row, price: round2(row.price) }))
  if (normalized.length === 0) return normalized
  if (targetTotal == null || !Number.isFinite(targetTotal)) return normalized

  let remainingCents =
    Math.round(round2(targetTotal) * 100) -
    normalized.reduce((sum, row) => sum + Math.round(row.price * 100), 0)
  if (remainingCents === 0) return normalized

  const direction = remainingCents > 0 ? 1 : -1
  remainingCents = Math.abs(remainingCents)
  const orderedIndexes = normalized
    .map((row, index) => ({ index, cents: Math.round(row.price * 100) }))
    .sort((left, right) => right.cents - left.cents)

  let cursor = 0
  while (remainingCents > 0 && orderedIndexes.length > 0) {
    const current = orderedIndexes[cursor % orderedIndexes.length]
    const currentCents = Math.round(normalized[current.index].price * 100)
    if (direction > 0 || currentCents > 0) {
      normalized[current.index].price = round2(
        (currentCents + direction) / 100
      )
      remainingCents -= 1
    }
    cursor += 1
    if (cursor > orderedIndexes.length * 100_000) break
  }

  return normalized
}

function cloneScopeBucket(bucket: ScopeBucket): ScopeBucket {
  return {
    texts: [...bucket.texts],
    price: bucket.price,
    rooms: [...bucket.rooms],
    paintProducts: [...bucket.paintProducts],
    subjectLabels: [...bucket.subjectLabels],
    notes: [...bucket.notes],
    coats: [...bucket.coats],
    primeModes: [...bucket.primeModes],
  }
}

function cloneScopeBuckets(scoped: ScopeBuckets): ScopeBuckets {
  return {
    walls: cloneScopeBucket(scoped.walls),
    ceilings: cloneScopeBucket(scoped.ceilings),
    trim: cloneScopeBucket(scoped.trim),
    doors: cloneScopeBucket(scoped.doors),
    drywall: cloneScopeBucket(scoped.drywall),
    cabinets: cloneScopeBucket(scoped.cabinets),
    other: cloneScopeBucket(scoped.other),
  }
}

function trimScopeKey(params: {
  trimLabel: string
  family: string
}): CustomerVisibleAllocationScopeKey {
  const category = trimCategory(params.trimLabel, params.family)
  if (category === 'door' || category === 'door_casing') return 'doors'
  if (category === 'cabinet') return 'cabinets'
  return 'trim'
}

function buildVisibleAllocationRows(normalized: NormalizedCustomerEstimateInput) {
  const rows: CustomerVisibleAllocationRow[] = []
  normalized.roomWallScopes.forEach((row, index) => {
    rows.push({
      id: `walls:${row.roomId}:${index}`,
      key: 'walls',
      roomId: row.roomId || null,
      sourceKind: 'walls',
      preFeePrice: row.price,
      included: row.included,
    })
  })
  normalized.roomCeilingScopes.forEach((row, index) => {
    rows.push({
      id: `ceilings:${row.roomId}:${index}`,
      key: 'ceilings',
      roomId: row.roomId || null,
      sourceKind: 'ceilings',
      preFeePrice: row.price,
      included: row.included,
    })
  })
  normalized.roomTrimScopes.forEach((row, index) => {
    const key = trimScopeKey({ trimLabel: row.trimLabel, family: row.family })
    rows.push({
      id: `${key}:${row.roomId}:scope:${index}`,
      key,
      roomId: row.roomId || null,
      sourceKind: key,
      preFeePrice: row.price,
      included: row.included,
    })
  })
  normalized.roomDoorScopes.forEach((row, index) => {
    rows.push({
      id: `doors:${row.roomId}:scope:${index}`,
      key: 'doors',
      roomId: row.roomId || null,
      sourceKind: 'doors',
      preFeePrice: row.price,
      included: row.included,
    })
  })
  normalized.roomDrywallScopes.forEach((row, index) => {
    const key = row.surface.toLowerCase().includes('wall') ? 'walls' : 'drywall'
    rows.push({
      id: `${key}:${row.roomId}:drywall:${index}`,
      key,
      roomId: row.roomId || null,
      sourceKind: 'drywall',
      preFeePrice: row.price,
      included: row.included,
    })
  })
  normalized.trimItems.forEach((row, index) => {
    const key = trimScopeKey({ trimLabel: row.trimLabel, family: row.family })
    rows.push({
      id: `${key}:${row.roomId}:item:${index}`,
      key,
      roomId: row.roomId || null,
      sourceKind: key,
      preFeePrice: row.price,
      included: true,
    })
  })
  normalized.otherRows.forEach((row, index) => {
    rows.push({
      id: `other:${row.location}:${index}`,
      key: 'other',
      roomId: row.location || null,
      sourceKind: 'other',
      preFeePrice: row.price,
      included: true,
    })
  })
  return rows
}

function applyHiddenFeeAllocation(params: {
  normalized: NormalizedCustomerEstimateInput
  scoped: ScopeBuckets
}) {
  const scoped = cloneScopeBuckets(params.scoped)
  const explicitHiddenFeeTotal = params.normalized.hiddenFees.reduce(
    (sum, fee) => sum + Math.max(0, round2(fee.amount)),
    0
  )
  const baseVisibleTotal = scopeTotal(scoped)
  const allocation = allocateHiddenCustomerFees({
    rows: buildVisibleAllocationRows(params.normalized),
    fees: [
      ...params.normalized.hiddenFees,
      ...buildPricingSummaryHiddenFees({
        pricingSummary: params.normalized.pricingSummary,
        baseVisibleTotal,
        explicitHiddenFeeTotal,
      }),
    ],
  })

  for (const [key, amount] of Object.entries(allocation.sectionAdjustments) as Array<
    [CustomerVisibleAllocationScopeKey, number]
  >) {
    if (amount > 0) {
      scoped[key].price = round2(scoped[key].price + amount)
    }
  }

  if (allocation.fallbackAdditionalWorkAmount > 0) {
    scoped.other.price = round2(scoped.other.price + allocation.fallbackAdditionalWorkAmount)
    if (scoped.other.texts.length === 0) {
      scoped.other.texts = ['Additional work is included in this quote.']
    }
  }

  return scoped
}

function scopeTotal(scoped: ScopeBuckets) {
  return round2(
    scoped.walls.price +
      scoped.ceilings.price +
      scoped.trim.price +
      scoped.doors.price +
      scoped.drywall.price +
      scoped.cabinets.price +
      scoped.other.price
  )
}

function finitePositiveAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? round2(amount) : 0
}

function buildPricingSummaryHiddenFees(params: {
  pricingSummary: NormalizedCustomerEstimateInput['pricingSummary']
  baseVisibleTotal: number
  explicitHiddenFeeTotal: number
}) {
  const pricingSummary = params.pricingSummary
  if (!pricingSummary?.finalTotal || pricingSummary.finalTotal <= 0) return []

  const fees: HiddenCustomerFee[] = []
  const laborRoundingAdjustment =
    Number.isFinite(pricingSummary.postLaborPolicyTotal) &&
    Number.isFinite(pricingSummary.prePolicyTotal)
      ? round2(Number(pricingSummary.postLaborPolicyTotal) - Number(pricingSummary.prePolicyTotal))
      : 0
  if (laborRoundingAdjustment > 0) {
    fees.push({
      id: 'pricing-summary:labor-rounding-adjustment',
      kind: 'labor_rounding_adjustment',
      roomId: null,
      amount: laborRoundingAdjustment,
    })
  }

  const minimumAdjustment = finitePositiveAmount(pricingSummary.minimumAdjustmentAmount)
  if (minimumAdjustment > 0) {
    fees.push({
      id: 'pricing-summary:job-minimum-adjustment',
      kind: 'job_minimum_adjustment',
      roomId: null,
      amount: minimumAdjustment,
    })
  }

  const knownHiddenTotal = round2(
    params.explicitHiddenFeeTotal + fees.reduce((sum, fee) => sum + fee.amount, 0)
  )
  const residual = round2(
    pricingSummary.finalTotal - params.baseVisibleTotal - knownHiddenTotal
  )
  if (residual > 0) {
    fees.push({
      id: 'pricing-summary:internal-manual-adjustment',
      kind: 'internal_manual_adjustment',
      roomId: null,
      amount: residual,
    })
  }

  return fees
}

function resolveQuoteValidityDays(
  overrideValue: string | number | null | undefined,
  settingsValue: number | null | undefined
) {
  for (const value of [overrideValue, settingsValue, 90]) {
    const candidate = Number(value)
    if (Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate)
    }
  }
  return 90
}
