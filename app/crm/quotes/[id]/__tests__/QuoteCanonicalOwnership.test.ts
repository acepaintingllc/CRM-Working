import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const quoteInternalPaths = [
  'app/crm/quotes/[id]/_components/EstimateV2EditorPageContent.tsx',
  'app/crm/quotes/[id]/_state/useEstimateV2EditorState.ts',
  'app/crm/quotes/[id]/_lib/estimateV2EditorNormalize.ts',
  'app/crm/quotes/[id]/send/SendQuoteClient.tsx',
  'app/crm/quotes/[id]/send/SendQuoteReviewClient.tsx',
  'app/crm/quotes/[id]/summary/_components/EstimateV2SummaryPageContent.tsx',
  'app/crm/quotes/[id]/summary/_lib/estimateV2SummaryDerived.ts',
]

const canonicalEstimateRuntimePaths = [
  'app/crm/estimates/[id]/v2/page.tsx',
  'app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent.tsx',
  'app/crm/estimates/[id]/v2/_components/EstimateV2EditorHeaderArea.tsx',
  'app/crm/estimates/[id]/v2/_components/EstimateV2Header.tsx',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2EditorLoader.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2SaveController.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2SettingsActions.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryData.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryLoader.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2SummaryPolicyController.ts',
  'app/crm/estimates/[id]/v2/_state/useEstimateV2TrimPaintController.ts',
  'app/crm/estimates/[id]/v2/summary/page.tsx',
  'app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx',
  'app/crm/estimates/[id]/send/_shared/customerSendWorkflow.ts',
  'app/crm/estimates/[id]/send/sendEstimateClient.tsx',
  'app/crm/estimates/[id]/send/sendEstimateReviewClient.tsx',
  'app/quote/[token]/page.tsx',
  'app/quote/[token]/QuotePortalClient.tsx',
  'lib/customer-estimates/PublicEstimatePortal.tsx',
]

const quoteAdminHookPaths = [
  'app/crm/quotes/_hooks/useQuoteDefaultsPage.ts',
  'app/crm/quotes/_hooks/useQuoteProductsPage.ts',
  'app/crm/quotes/_hooks/quoteProductsControllerUtils.ts',
  'app/crm/quotes/_hooks/useQuoteRatesPage.ts',
  'app/crm/quotes/_hooks/useQuotesHomeData.ts',
  'app/crm/quotes/_hooks/useQuotesHomeDelete.ts',
  'app/crm/quotes/_hooks/useQuotesHomePage.ts',
  'app/crm/quotes/_hooks/useQuoteVersionCreation.ts',
]

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function getImportSpecifiers(source: string) {
  return Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), (match) => match[1])
}

function isForbiddenQuoteAdminImport(specifier: string) {
  return (
    specifier.startsWith('@/app/crm/estimates/[id]/v2') ||
    specifier.startsWith('@/app/crm/estimates/[id]/send') ||
    specifier.startsWith('@/lib/server/estimate')
  )
}

function isForbiddenCanonicalRuntimeImport(specifier: string) {
  return (
    specifier.startsWith('@/app/crm/quotes/[id]/') ||
    specifier.startsWith('@/lib/quotes/client') ||
    specifier.startsWith('./_components/') ||
    specifier.startsWith('./_hooks/')
  )
}

describe('quote canonical ownership guardrails', () => {
  it('does not keep quote-side V2 implementation files after canonicalization', () => {
    for (const relativePath of quoteInternalPaths) {
      expect(existsSync(path.resolve(process.cwd(), relativePath))).toBe(false)
    }
  })

  it('keeps canonical estimate runtime code free of hardcoded quote route strings', () => {
    for (const relativePath of canonicalEstimateRuntimePaths) {
      const source = readSource(relativePath)
      const imports = getImportSpecifiers(source)

      expect(source.includes('/api/quotes')).toBe(false)
      expect(source.includes('/crm/quotes')).toBe(false)
      expect(imports.some(isForbiddenCanonicalRuntimeImport)).toBe(false)
    }
  })

  it('keeps quote admin hooks isolated from estimate runtime and server internals', () => {
    for (const relativePath of quoteAdminHookPaths) {
      const imports = getImportSpecifiers(readSource(relativePath))
      expect(imports.some(isForbiddenQuoteAdminImport)).toBe(false)
    }
  })
})
