import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2EditorFooterBar } from '../EstimateV2EditorFooterBar'

const styles = {
  footer: {},
  mono: {},
  button: {},
  buttonPrimary: {},
}

const pageVm = {
  loading: false,
  saving: false,
  error: null,
  validationIssues: [],
  emptySelectionMessage: '',
  roomsCount: 2,
}

const summaryVm = {
  runningTotalLabel: 'Active scope totals - 2 rooms',
  activeScopeTotals: [{ key: 'trim', label: 'Trim', value: '42 LF' }],
}

function footer({
  saveDraft = vi.fn(),
  saveAndContinue = vi.fn(),
  canManualSave = true,
  canSaveAndContinue = true,
}: {
  saveDraft?: () => void
  saveAndContinue?: () => void
  canManualSave?: boolean
  canSaveAndContinue?: boolean
} = {}) {
  return (
    <EstimateV2EditorFooterBar
      styles={styles as never}
      pageVm={pageVm as never}
      saveVm={
        {
          dirty: true,
          canManualSave,
          canSaveAndContinue,
          saveStatusText: 'Unsaved changes - ready to save',
          saveStatusColor: '#f9e2b7',
          blockedReason: null,
          save: vi.fn(async () => true),
          saveDraft,
          saveAndContinue,
        } as never
      }
      summaryVm={summaryVm as never}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EstimateV2EditorFooterBar', () => {
  it('renders save labels and delegates Save draft to the supplied action', () => {
    const saveDraft = vi.fn()
    render(footer({ saveDraft }))
    const saveDraftButton = screen.getByRole('button', { name: 'Save draft' })

    expect(screen.getByText('Unsaved changes - ready to save')).toBeInTheDocument()
    expect(screen.getByText('Active scope totals - 2 rooms')).toBeInTheDocument()
    fireEvent.click(saveDraftButton)

    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('delegates Save & continue to the supplied action', () => {
    const saveAndContinue = vi.fn()
    render(footer({ saveAndContinue }))
    const saveAndContinueButton = screen.getByRole('button', { name: 'Save & continue ->' })

    fireEvent.click(saveAndContinueButton)

    expect(saveAndContinue).toHaveBeenCalledTimes(1)
  })

  it('disables buttons from save VM state without owning save orchestration', () => {
    render(footer({ canManualSave: false, canSaveAndContinue: false }))

    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save & continue ->' })).toBeDisabled()
  })
})
