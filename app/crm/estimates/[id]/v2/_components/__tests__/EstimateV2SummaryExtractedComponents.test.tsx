import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EstimateV2ErrorBoundary } from '../EstimateV2ErrorBoundary'
import { EstimateV2SummaryAlerts } from '../../summary/_components/EstimateV2SummaryAlerts'
import { EstimateV2SummaryKPIRail } from '../../summary/_components/EstimateV2SummaryKPIRail'
import { EstimateV2SummaryPricingTable } from '../../summary/_components/EstimateV2SummaryPricingTable'
import { EstimateV2SummaryRoomBlock } from '../../summary/_components/EstimateV2SummaryRoomBlock'
import { EstimateV2SummaryRail } from '../EstimateV2SummaryRail'

const cardStyle = { border: '1px solid #333', padding: 8, background: '#111' }
const pricingColors = {
  ink: '#fff',
  ink2: '#ccc',
  ink3: '#999',
  green: '#8ad39b',
  border: '#333',
  cardDark: '#111',
  mono: 'monospace',
}

describe('Estimate V2 summary extracted components', () => {
  it('renders KPI rail and alert banners from typed view models', () => {
    render(
      <>
        <EstimateV2SummaryKPIRail
          pricingKpis={{
            finalTotal: 4200,
            laborHours: 18,
            laborDays: 2.25,
            laborCost: 1440,
            suppliesCost: 360,
            rooms: 3,
            laborRate: 80,
            rawLaborHours: null,
            rawLaborDays: null,
          }}
          finalTotal={4200}
          laborShare={233}
          colors={{ cardStyle, ink: '#fff', ink3: '#999', green: '#8ad39b', mono: 'monospace' }}
        />
        <EstimateV2SummaryAlerts
          alerts={[
            { kind: 'warn', title: 'Manual override detected', detail: 'Scope override active' },
            { kind: 'info', title: 'No active alerts', detail: 'Estimate is currently clean' },
          ]}
          colors={{ ink: '#fff', ink3: '#999', radiusSm: 6 }}
        />
      </>
    )

    expect(screen.getByText('Final Total')).toBeInTheDocument()
    expect(screen.getByText('$4,200')).toBeInTheDocument()
    expect(screen.getByText('Manual override detected')).toBeInTheDocument()
    expect(screen.getByText('Estimate is currently clean')).toBeInTheDocument()
  })

  it('renders pricing tables and room blocks, and toggles room expansion', () => {
    const onToggle = vi.fn()

    render(
      <>
        <EstimateV2SummaryPricingTable
          title="Price Breakdown"
          rows={[
            { label: 'Base Estimate / Pre-policy total', value: '$3,900' },
            { label: 'Labor Adjustment', value: '$300' },
          ]}
          totalLabel="Final Total"
          totalValue="$4,200"
          colors={pricingColors}
          cardStyle={cardStyle}
        />
        <EstimateV2SummaryRoomBlock
          block={{
            room: { id: 'room-1', room_id: 'R001', room_name: 'Living Room' },
            scopeRows: [
              {
                id: 'scope-1',
                roomId: 'R001',
                kind: 'walls',
                label: 'Walls',
                quantity: 220,
                laborHours: 8,
                paintCost: 120,
                suppliesCost: 40,
                subtotal: 900,
                hasOverride: true,
                overrideSummary: 'Override: Area: 220 sf',
                missingProduct: false,
                conditionSelections: {},
              },
            ],
            displayScopeSubtotalMap: new Map([['scope-1', 900]]),
            scopes: ['Walls'],
            roomArea: 220,
            roomTotal: 900,
            roomPct: 0.21,
            totals: { labor: 8, paint: 120, supplies: 40 },
            flagsLabel: 'None',
            alerts: { missingProduct: 0, overrides: 1, flags: 0 },
            conditionBadges: [],
          }}
          open
          onToggle={onToggle}
          displayScopePaintCost={() => 120}
          cardStyle={cardStyle}
        />
      </>
    )

    expect(screen.getByText('Labor Adjustment')).toBeInTheDocument()
    expect(screen.getByText('Living Room')).toBeInTheDocument()
    expect(screen.getAllByText('$900').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Override: Area: 220 sf')).toHaveAttribute(
      'title',
      'Override: Area: 220 sf'
    )

    const toggle = screen.getByRole('button', { name: /living room room details/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalled()
    expect(screen.getAllByText('Walls').length).toBeGreaterThan(0)
  })

  it('hides primer in the editor summary rail when a section does not use primer', () => {
    render(
      <EstimateV2SummaryRail
        styles={{
          mono: { fontFamily: 'monospace' },
        } as never}
        vm={{
          roomLabel: 'R001',
          roomName: 'Living Room',
          roomSubtitle: 'Living Room - Ceilings',
          includedScopeLabels: 'Ceilings',
          scopeToggleLabels: { walls: 'Walls excluded', ceilings: 'Ceilings included', trim: 'Trim excluded' },
          validationText: 'No open issues',
          validationColor: '#ccc',
          calculationStateText: 'Saved',
          calculationStateColor: '#ccc',
          totalEffectiveAreaText: '144 sf',
          runningTotalLabel: 'Running total - 1 room - active scopes',
          saveStatusText: 'Saved',
          saveStatusColor: '#ccc',
          walls: {
            visible: false,
            title: 'Walls',
            primaryValue: '0',
            primaryUnit: 'Sq Ft',
            paintLabel: 'Wall Paint',
            primerLabel: 'Wall Primer',
            chips: [],
          },
          ceilings: {
            visible: true,
            title: 'Ceilings',
            modeLabel: 'RECT',
            primaryValue: '144',
            primaryUnit: 'Sq Ft',
            paintLabel: 'Ceiling Paint',
            primerLabel: 'Ceiling Primer',
            showPrimer: false,
            chips: [],
          },
          trim: {
            visible: false,
            title: 'Trim',
            primaryValue: '0',
            primaryUnit: 'LF / EA / SF',
            paintLabel: 'Trim Paint',
            primerLabel: 'Trim Primer',
            chips: [],
          },
        }}
        onFocusSection={vi.fn()}
      />
    )

    expect(screen.getByText('Paint: Ceiling Paint')).toBeInTheDocument()
    expect(screen.queryByText('Primer: Ceiling Primer')).not.toBeInTheDocument()
  })
})

describe('EstimateV2ErrorBoundary', () => {
  it('renders recovery UI after a render crash', () => {
    const ProblemChild = () => {
      throw new Error('boom')
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <EstimateV2ErrorBoundary>
        <ProblemChild />
      </EstimateV2ErrorBoundary>
    )

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editor crashed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload estimate editor' })).toBeInTheDocument()

    errorSpy.mockRestore()
  })
})
