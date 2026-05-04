import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2Header } from '../EstimateV2Header'
import { estimateV2EditorPageStyles } from '../estimateV2EditorPageStyles'

const vm = {
  estimateId: 'estimate-1',
  resumeRecord: {
    estimate: null,
    job: null,
  },
  titleText: 'Version A',
  subtitleText: 'Job - Ada - 123 Main',
  workflowText: 'Estimate V2 Editor',
  dirtyStateText: '',
  dirtyStateColor: null,
  dirty: false,
  saving: false,
  settingsOpen: false,
  toggleSettings: vi.fn(),
  addRoom: vi.fn(),
}

describe('EstimateV2Header', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the streamlined header actions without workflow navigation controls', () => {
    render(
      <EstimateV2Header
        styles={estimateV2EditorPageStyles}
        vm={vm}
        onBack={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Collapse estimator header' })).not.toBeInTheDocument()
    expect(screen.queryByText('Summary ->')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next: Details & Overrides ->' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add room' })).not.toBeInTheDocument()
  })

  it('wires the editor Settings action to the settings drawer trigger state', () => {
    const toggleSettings = vi.fn()

    render(
      <EstimateV2Header
        styles={estimateV2EditorPageStyles}
        vm={{ ...vm, settingsOpen: true, toggleSettings }}
        onBack={vi.fn()}
      />
    )

    const settingsButton = screen.getByRole('button', { name: 'Settings' })
    expect(settingsButton).toHaveAttribute('aria-controls', 'estimate-v2-settings-drawer')
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true')

    settingsButton.click()

    expect(toggleSettings).toHaveBeenCalledTimes(1)
  })
})
