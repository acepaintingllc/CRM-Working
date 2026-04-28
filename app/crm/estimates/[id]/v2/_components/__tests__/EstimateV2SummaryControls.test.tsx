import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2SummaryPolicyControls } from '../EstimateV2SummaryPolicyControls'
import { EstimateV2SummaryTrimPaintPanel } from '../EstimateV2SummaryTrimPaintPanel'

const card = { border: '1px solid #333', padding: 8 }
const inputStyle = { border: '1px solid #444', padding: 4 }
const colors = {
  border: '#333',
  ink: '#fff',
  ink3: '#999',
  green: '#8ad39b',
  cardDark: '#111',
  radiusSm: 6,
}

afterEach(() => {
  cleanup()
})

describe('EstimateV2 summary controls', () => {
  it('collapses pricing policy controls behind a compact status summary', () => {
    const update = vi.fn()
    const onToggleOpen = vi.fn()
    const { rerender } = render(
      <EstimateV2SummaryPolicyControls
        vm={{
          draft: {
            laborDayEnabled: true,
            dayhours: 8,
            roundIncrement: 4,
            laborRate: 65,
            jobMinEnabled: false,
            jobMinAmount: 1200,
          },
          update,
          saving: false,
        }}
        card={card}
        inputStyle={inputStyle}
        colors={colors}
        open={false}
        onToggleOpen={onToggleOpen}
      />
    )

    expect(screen.getByText('Policies: Labor Day On • Job Minimum Off')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hours per day')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Job minimum amount dollars')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand pricing policies' }))
    expect(onToggleOpen).toHaveBeenCalledTimes(1)

    rerender(
      <EstimateV2SummaryPolicyControls
        vm={{
          draft: {
            laborDayEnabled: true,
            dayhours: 8,
            roundIncrement: 4,
            laborRate: 65,
            jobMinEnabled: false,
            jobMinAmount: 1200,
          },
          update,
          saving: false,
        }}
        card={card}
        inputStyle={inputStyle}
        colors={colors}
        open
        onToggleOpen={onToggleOpen}
      />
    )

    expect(screen.getByLabelText('Hours per day')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Toggle job minimum' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse labor day policy settings' }))
    expect(screen.queryByLabelText('Hours per day')).not.toBeInTheDocument()
  })

  it('routes policy field edits through the shared policy vm', () => {
    const update = vi.fn()
    render(
      <EstimateV2SummaryPolicyControls
        vm={{
          draft: {
            laborDayEnabled: false,
            dayhours: 8,
            roundIncrement: 4,
            laborRate: 65,
            jobMinEnabled: true,
            jobMinAmount: 1200,
          },
          update,
          saving: false,
        }}
        card={card}
        inputStyle={inputStyle}
        colors={colors}
        open
      />
    )

    fireEvent.click(screen.getAllByRole('switch')[0])
    fireEvent.change(screen.getByDisplayValue('65'), { target: { value: '72' } })
    fireEvent.change(screen.getByDisplayValue('1200'), { target: { value: '1400' } })

    expect(update).toHaveBeenCalledWith({ laborDayEnabled: true })
    expect(update).toHaveBeenCalledWith({ laborRate: 72 })
    expect(update).toHaveBeenCalledWith({ jobMinAmount: 1400 })
  })

  it('routes trim paint edits through the shared trim paint vm', () => {
    const update = vi.fn()
    render(
      <EstimateV2SummaryTrimPaintPanel
        vm={{
          draft: {
            trimPaintProductId: 'SW-01',
            trimPaintGallons: 2,
            trimPaintQuarts: 1,
          },
          update,
        }}
        trimPaint={{
          paint_product_id: 'SW-01',
          paint_product_label: 'Duration',
          gallons: 2,
          quarts: 1,
          normalized_gallons: 2.25,
          paint_cost: 180,
        }}
        hasTrimPaint
        resolvePaintProductLabel={() => 'Duration'}
        card={card}
        inputStyle={inputStyle}
        colors={colors}
      />
    )

    fireEvent.change(screen.getByDisplayValue('SW-01'), { target: { value: 'SW-99' } })
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3' } })
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })

    expect(update).toHaveBeenCalledWith({ trimPaintProductId: 'SW-99' })
    expect(update).toHaveBeenCalledWith({ trimPaintGallons: 3 })
    expect(update).toHaveBeenCalledWith({ trimPaintQuarts: 2 })
  })
})
