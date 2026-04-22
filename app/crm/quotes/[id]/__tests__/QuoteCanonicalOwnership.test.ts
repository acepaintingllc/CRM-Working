import { existsSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const quoteInternalPaths = [
  'app/crm/quotes/[id]/_components/EstimateV2EditorPageContent.tsx',
  'app/crm/quotes/[id]/_state/useEstimateV2EditorState.ts',
  'app/crm/quotes/[id]/_lib/estimateV2EditorNormalize.ts',
  'app/crm/quotes/[id]/summary/_components/EstimateV2SummaryPageContent.tsx',
  'app/crm/quotes/[id]/summary/_lib/estimateV2SummaryDerived.ts',
]

describe('quote canonical ownership guardrails', () => {
  it('does not keep quote-side V2 implementation files after canonicalization', () => {
    for (const relativePath of quoteInternalPaths) {
      expect(existsSync(path.resolve(process.cwd(), relativePath))).toBe(false)
    }
  })
})
