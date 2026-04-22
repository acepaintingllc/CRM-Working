import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuoteWorkspacePage from '../page'
import SendQuotePage from '../send/page'
import QuoteSummaryPage from '../summary/page'

vi.mock('@/app/crm/estimates/[id]/v2/_components/EstimateV2ErrorBoundary', () => ({
  EstimateV2ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent', () => ({
  EstimateV2EditorPageContent: ({
    estimateId,
    routeFamily,
  }: {
    estimateId?: string
    routeFamily: { summaryHref: (estimateId: string) => string }
  }) => (
    <div>editor:{estimateId}:{routeFamily.summaryHref(estimateId ?? '')}</div>
  ),
}))

vi.mock('@/app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent', () => ({
  EstimateV2SummaryPageContent: ({
    estimateId,
    routeFamily,
  }: {
    estimateId: string
    routeFamily: { editorHref: (estimateId: string) => string }
  }) => (
    <div>summary:{estimateId}:{routeFamily.editorHref(estimateId)}</div>
  ),
}))

vi.mock('@/app/crm/estimates/[id]/send/sendEstimateClient', () => ({
  default: ({
    estimateId,
    routeFamily,
  }: {
    estimateId: string
    routeFamily: { sendHref: (estimateId: string) => string }
  }) => (
    <div>send:{estimateId}:{routeFamily.sendHref(estimateId)}</div>
  ),
}))

describe('quote route aliases', () => {
  it('mounts the canonical estimate v2 workspace content', async () => {
    render(await QuoteWorkspacePage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('editor:estimate-1:/crm/quotes/estimate-1/summary')).toBeTruthy()
  })

  it('mounts the canonical estimate v2 summary content', async () => {
    render(await QuoteSummaryPage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('summary:estimate-1:/crm/quotes/estimate-1')).toBeTruthy()
  })

  it('mounts the canonical estimate send content with quote aliases', async () => {
    render(await SendQuotePage({ params: { id: 'estimate-1' } }))
    expect(screen.getByText('send:estimate-1:/crm/quotes/estimate-1/send')).toBeTruthy()
  })
})
