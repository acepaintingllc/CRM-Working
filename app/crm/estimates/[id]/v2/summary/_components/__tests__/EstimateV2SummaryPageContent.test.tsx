import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2SummaryPageContent } from '../EstimateV2SummaryPageContent'

const mockLoadData = vi.hoisted(() => vi.fn())
const mockUseEstimateV2SummaryData = vi.fn()
const mockUseEstimateV2SummaryDerived = vi.fn()

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../../../_state/useEstimateV2SummaryData', () => ({
  useEstimateV2SummaryData: (...args: unknown[]) => mockUseEstimateV2SummaryData(...args),
}))

vi.mock('@/lib/client/api', () => ({
  loadData: mockLoadData,
}))

vi.mock('../../_lib/useEstimateV2SummaryDerived', () => ({
  useEstimateV2SummaryDerived: (...args: unknown[]) => mockUseEstimateV2SummaryDerived(...args),
}))

const baseDataState = {
  data: { estimate: { version_name: 'Estimate A', version_state: 'Draft' }, inputs: {} },
  job: { customer_name: 'Ada Lovelace', customer_address: '123 Main St' },
  loading: false,
  error: null,
  policySaving: false,
  jobSettingsVm: {
    draft: {
      laborDayEnabled: false,
      dayhours: 8,
      roundIncrement: 4,
      laborRate: 80,
      jobMinEnabled: false,
      jobMinAmount: 0,
    },
    update: vi.fn(),
    saving: false,
  },
  trimPaintVm: {
    draft: {
      trimPaintProductId: '',
      trimPaintGallons: 0,
      trimPaintQuarts: 0,
    },
    update: vi.fn(),
  },
}

const baseDerivedState = {
  pricingKpis: {
    finalTotal: 1200,
    laborHours: 10,
    laborDays: 1.25,
    laborCost: 800,
    suppliesCost: 60,
    rooms: 1,
    laborRate: 80,
  },
  finalTotal: 1200,
  laborShare: 120,
  summaryAlerts: [{ kind: 'info', title: 'No active alerts', detail: 'Estimate is currently clean' }],
  priceBreakdownRows: [
    { label: 'Base Estimate / Pre-policy total', value: '$1,000' },
    { label: 'Labor Adjustment', value: '$100' },
  ],
  paintSupplyRows: [{ label: 'Supplies', value: '$60' }],
  paintSuppliesTotal: 60,
  rooms: [{ id: 'room-1', room_id: 'room-1', room_name: 'Living Room' }],
  roomBlocks: [
    {
      room: { id: 'room-1', room_id: 'room-1', room_name: 'Living Room' },
      scopeRows: [],
      displayScopeSubtotalMap: new Map(),
      scopes: ['Walls'],
      roomArea: 220,
      roomTotal: 1200,
      roomPct: 1,
      totals: { labor: 10, paint: 100, supplies: 60 },
      flagsLabel: 'None',
      alerts: { missingProduct: 0, overrides: 0, flags: 0 },
    },
  ],
  displayScopePaintCost: vi.fn(() => 0),
  trimPaint: null,
  hasTrimPaint: false,
  resolvePaintProductLabel: vi.fn(() => 'Paint'),
  versionName: 'Estimate A',
  statusLabel: 'Draft',
}

describe('EstimateV2SummaryPageContent', () => {
  beforeEach(() => {
    mockLoadData.mockResolvedValue({ version: null, public_url: null })
    mockUseEstimateV2SummaryData.mockReturnValue(baseDataState)
    mockUseEstimateV2SummaryDerived.mockReturnValue(baseDerivedState)
  })

  it('announces loading state accessibly', () => {
    mockUseEstimateV2SummaryData.mockReturnValue({
      ...baseDataState,
      loading: true,
    })

    render(<EstimateV2SummaryPageContent estimateId="estimate-1" />)

    expect(screen.getByRole('status', { name: 'Loading quote summary' })).toHaveTextContent(
      'Loading summary...'
    )
  })

  it('announces blocking errors accessibly', () => {
    mockUseEstimateV2SummaryData.mockReturnValue({
      ...baseDataState,
      error: { message: 'Failed to refresh pricing', retryable: true },
      data: null,
    })

    render(<EstimateV2SummaryPageContent estimateId="estimate-1" />)

    expect(screen.getByRole('alert', { name: 'Quote summary failed to load' })).toHaveTextContent(
      'Failed to refresh pricing'
    )
  })

  it('updates room accordion aria state when toggled', () => {
    render(<EstimateV2SummaryPageContent estimateId="estimate-1" />)

    const toggle = screen.getAllByRole('button', { name: /living room room details/i })[0]

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
