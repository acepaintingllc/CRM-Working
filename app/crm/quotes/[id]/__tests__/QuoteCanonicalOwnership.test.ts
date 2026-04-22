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
  'app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent.tsx',
  'app/crm/estimates/[id]/send/_shared/customerSendWorkflow.ts',
  'app/crm/estimates/[id]/send/sendEstimateClient.tsx',
  'app/crm/estimates/[id]/send/sendEstimateReviewClient.tsx',
]

const quoteAdminHookPaths = [
  'app/crm/quotes/_hooks/useQuoteDefaultsPage.ts',
  'app/crm/quotes/_hooks/useQuoteProductEditorState.ts',
  'app/crm/quotes/_hooks/useQuoteProductMutations.ts',
  'app/crm/quotes/_hooks/useQuoteProductsCatalogState.ts',
  'app/crm/quotes/_hooks/useQuoteProductsPage.ts',
  'app/crm/quotes/_hooks/useQuoteRatesEditorState.ts',
  'app/crm/quotes/_hooks/useQuoteRatesFilters.ts',
  'app/crm/quotes/_hooks/useQuoteRatesPage.ts',
  'app/crm/quotes/_hooks/useQuoteRatesPersistence.ts',
  'app/crm/quotes/_hooks/useQuotesHomeData.ts',
  'app/crm/quotes/_hooks/useQuotesHomeDelete.ts',
  'app/crm/quotes/_hooks/useQuotesHomePage.ts',
  'app/crm/quotes/_hooks/useQuotesHomeSelection.ts',
  'app/crm/quotes/_hooks/useQuoteVersionCreation.ts',
]

const forbiddenQuoteAdminImports = [
  "@/app/crm/estimates",
  "@/lib/server/estimate",
  "app/crm/estimates/[id]/v2",
  "app/crm/estimates/[id]/send",
]

describe('quote canonical ownership guardrails', () => {
  it('does not keep quote-side V2 implementation files after canonicalization', () => {
    for (const relativePath of quoteInternalPaths) {
      expect(existsSync(path.resolve(process.cwd(), relativePath))).toBe(false)
    }
  })

  it('keeps canonical estimate runtime code free of hardcoded quote route strings', () => {
    for (const relativePath of canonicalEstimateRuntimePaths) {
      const source = readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
      expect(source.includes('/api/quotes')).toBe(false)
      expect(source.includes('/crm/quotes')).toBe(false)
      expect(source.includes('@/lib/quotes/client')).toBe(false)
    }
  })

  it('keeps quote admin hooks isolated from estimate runtime and server internals', () => {
    for (const relativePath of quoteAdminHookPaths) {
      const source = readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
      for (const forbiddenImport of forbiddenQuoteAdminImports) {
        expect(source.includes(forbiddenImport)).toBe(false)
      }
    }
  })
})
