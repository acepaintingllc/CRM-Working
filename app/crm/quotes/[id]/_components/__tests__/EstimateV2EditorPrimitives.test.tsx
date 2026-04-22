import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  PrimerModeButtons,
  ReorderDeleteActions,
  ScopeSummaryChips,
} from '../EstimateV2EditorPrimitives'

describe('EstimateV2EditorPrimitives', () => {
  it('renders summary chips with warning tone content', () => {
    render(
      <ScopeSummaryChips
        chips={[
          { label: 'Mode: RECT' },
          { label: '2 issue(s)', tone: 'warning' },
        ]}
        chipStyle={{}}
      />
    )

    expect(screen.getByText('Mode: RECT')).toBeInTheDocument()
    expect(screen.getByText('2 issue(s)')).toBeInTheDocument()
  })

  it('wires reorder and delete actions', () => {
    const onMoveUp = vi.fn()
    const onMoveDown = vi.fn()
    const onDelete = vi.fn()

    render(
      <ReorderDeleteActions
        styles={{ button: {} }}
        disableMoveUp={false}
        disableMoveDown={false}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByText('Up'))
    fireEvent.click(screen.getByText('Down'))
    fireEvent.click(screen.getByText('Delete'))

    expect(onMoveUp).toHaveBeenCalledTimes(1)
    expect(onMoveDown).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('preserves primer mode interactions', () => {
    const onChange = vi.fn()

    render(
      <PrimerModeButtons
        currentMode="SPOT"
        onChange={onChange}
        styles={{ button: {} }}
      />
    )

    fireEvent.click(screen.getByText('Full'))

    expect(onChange).toHaveBeenCalledWith('FULL')
  })
})
