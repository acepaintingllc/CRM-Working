import { readFileSync } from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuoteWorkspacePage from '../page'
import QuoteDetailsPage from '../details/page'
import SendQuotePage from '../send/page'
import QuoteSummaryPage from '../summary/page'

vi.mock('@/app/crm/estimates/[id]/v2/_components/EstimateV2ErrorBoundary', () => ({
  EstimateV2ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent', () => ({
  EstimateV2EditorPageContent: ({
    estimateId,
    routeFamilyKey,
  }: {
    estimateId?: string
    routeFamilyKey?: 'estimate' | 'quote'
  }) => (
    <div>editor:{estimateId}:{routeFamilyKey}</div>
  ),
}))

vi.mock('@/app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent', () => ({
  EstimateV2SummaryPageContent: ({
    estimateId,
    routeFamilyKey,
  }: {
    estimateId: string
    routeFamilyKey?: 'estimate' | 'quote'
  }) => (
    <div>summary:{estimateId}:{routeFamilyKey}</div>
  ),
}))

vi.mock('@/app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent', () => ({
  EstimateV2DetailsPageContent: ({
    estimateId,
    routeFamilyKey,
  }: {
    estimateId: string
    routeFamilyKey?: 'estimate' | 'quote'
  }) => (
    <div>details:{estimateId}:{routeFamilyKey}</div>
  ),
}))

vi.mock('@/app/crm/estimates/[id]/send/sendEstimateClient', () => ({
  default: ({
    estimateId,
    routeFamilyKey,
  }: {
    estimateId: string
    routeFamilyKey?: 'estimate' | 'quote'
  }) => (
    <div>send:{estimateId}:{routeFamilyKey}</div>
  ),
}))

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function getImportSpecifiers(source: string) {
  return Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), (match) => match[1]).sort()
}

function getRelativeImportSpecifiers(source: string) {
  return getImportSpecifiers(source).filter((specifier) => specifier.startsWith('.'))
}

describe('quote route aliases', () => {
  it('keeps quote route files as thin composition layers over canonical estimate modules', () => {
    expect(
      getImportSpecifiers(readSource('app/crm/quotes/[id]/page.tsx'))
    ).toEqual([
      '@/app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent',
      '@/app/crm/estimates/[id]/v2/_components/EstimateV2ErrorBoundary',
    ])

    expect(
      getImportSpecifiers(readSource('app/crm/quotes/[id]/summary/page.tsx'))
    ).toEqual([
      '@/app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent',
    ])

    expect(
      getImportSpecifiers(readSource('app/crm/quotes/[id]/details/page.tsx'))
    ).toEqual([
      '@/app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent',
    ])

    expect(
      getImportSpecifiers(readSource('app/crm/quotes/[id]/send/page.tsx'))
    ).toEqual([
      '@/app/crm/estimates/[id]/send/sendEstimateClient',
    ])
  })

  it('keeps the quote details route free of route-local implementation imports', () => {
    const source = readSource('app/crm/quotes/[id]/details/page.tsx')

    expect(getRelativeImportSpecifiers(source)).toEqual([])
    expect(source.includes('@/app/crm/quotes/[id]/details/_')).toBe(false)
    expect(source.includes('./_')).toBe(false)
    expect(source).toContain(
      '@/app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent'
    )
  })

  it('mounts the canonical estimate v2 workspace content', async () => {
    render(await QuoteWorkspacePage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('editor:estimate-1:quote')).toBeTruthy()
  })

  it('mounts the canonical estimate v2 summary content', async () => {
    render(await QuoteSummaryPage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('summary:estimate-1:quote')).toBeTruthy()
  })

  it('mounts the canonical estimate v2 details content', async () => {
    render(await QuoteDetailsPage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('details:estimate-1:quote')).toBeTruthy()
  })

  it('mounts the canonical estimate send content with quote aliases', async () => {
    render(await SendQuotePage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('send:estimate-1:quote')).toBeTruthy()
  })
})
