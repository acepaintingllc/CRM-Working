import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2Header } from '../EstimateV2Header'
import { estimateV2EditorPageStyles } from '../estimateV2EditorPageStyles'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    style,
  }: {
    href: string
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
    style?: React.CSSProperties
  }) => (
    <a href={href} onClick={onClick} style={style}>
      {children}
    </a>
  ),
}))

const routeFamily = {
  listHref: '/crm/estimates',
  editorHref: (id: string) => `/crm/estimates/${id}/v2`,
  detailsHref: (id: string) => `/crm/estimates/${id}/v2/details`,
  summaryHref: (id: string) => `/crm/estimates/${id}/v2/summary`,
  sendHref: (id: string) => `/crm/estimates/${id}/send`,
  estimateApiHref: (id: string) => `/api/estimates/${id}`,
  catalogsApiHref: (id: string) => `/api/estimates/${id}/catalogs`,
  customerSendApiHref: (id: string) => `/api/estimates/${id}/customer-send`,
}

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
  dirty: false,
  saving: false,
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
        routeFamily={routeFamily}
        vm={vm}
        confirmNavigation={() => true}
      />
    )

    expect(screen.queryByRole('button', { name: 'Collapse estimator header' })).not.toBeInTheDocument()
    expect(screen.queryByText('Summary ->')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next: Details & Overrides ->' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add room' })).not.toBeInTheDocument()
  })
})
