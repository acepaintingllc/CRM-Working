import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobCloseoutPanel from '../JobCloseoutPanel'

describe('JobCloseoutPanel', () => {
  it('renders nothing when no closeout reference VM is provided', () => {
    const { container } = render(<JobCloseoutPanel vm={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders closeout notes and paint logs from a render-ready VM', () => {
    render(
      <JobCloseoutPanel
        vm={{
          notes: 'Left extra paint in garage.',
          hasNotes: true,
          paintLogs: [
            {
              key: 'paint-1',
              area: 'Kitchen',
              product: 'Duration',
              sheen: 'Eggshell',
              color: 'SW 7008',
              notes: 'Accent wall',
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Closeout Reference')).toBeTruthy()
    expect(screen.getByText('Left extra paint in garage.')).toBeTruthy()
    expect(screen.getByText('Kitchen')).toBeTruthy()
    expect(screen.getByText('Product: Duration | Sheen: Eggshell | Color: SW 7008')).toBeTruthy()
    expect(screen.getByText('Accent wall')).toBeTruthy()
  })

  it('uses the shared empty state for completed jobs without paint logs', () => {
    render(
      <JobCloseoutPanel
        vm={{
          notes: 'No closeout notes yet.',
          hasNotes: false,
          paintLogs: [],
        }}
      />
    )

    expect(screen.getByText('No paint logs')).toBeTruthy()
    expect(screen.getByText('No paint logs saved yet.')).toBeTruthy()
  })
})
