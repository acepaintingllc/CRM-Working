import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalSection } from '@/app/crm/_components/CrmModalSection'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

describe('CRM primitives', () => {
  it('renders the header with navigation, metadata, and actions', () => {
    render(
      <CrmPageShell>
        <CrmPageHeader
          eyebrow="Operations"
          emoji="🧭"
          title="Customers"
          description="Manage customer records."
          meta={<span>Meta</span>}
          backHref="/crm"
          backLabel="Back to CRM"
          actions={<CrmButton>Action</CrmButton>}
        />
      </CrmPageShell>
    )

    expect(screen.getByText('Customers')).toBeTruthy()
    expect(screen.getByText('Manage customer records.')).toBeTruthy()
    expect(screen.getByText('Operations')).toBeTruthy()
    expect(screen.getByText('Meta')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to CRM' }).getAttribute('href')).toBe('/crm')
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy()
  })

  it('renders notice and empty states with their shared content', () => {
    render(
      <div>
        <CrmNotice tone="warning" title="Heads up" emoji="⚠️">
          Check this workflow.
        </CrmNotice>
        <CrmEmptyState
          emoji="📭"
          title="Nothing here"
          description="Add a record to get started."
          action={<CrmButton>Create</CrmButton>}
        />
      </div>
    )

    expect(screen.getByText('Heads up')).toBeTruthy()
    expect(screen.getByText('Check this workflow.')).toBeTruthy()
    expect(screen.getByText('Nothing here')).toBeTruthy()
    expect(screen.getByText('Add a record to get started.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
  })

  it('renders section cards, fields, and detail layouts inside the CRM system', () => {
    render(
      <CrmPageShell>
        <CrmSectionCard title="Section title" description="Section body">
          <CrmField label="Business name" help="Shown in emails.">
            <input aria-label="Business name input" />
          </CrmField>
          <CrmDetailLayout main={<div>Main column</div>} side={<div>Side rail</div>} />
        </CrmSectionCard>
      </CrmPageShell>
    )

    expect(screen.getByText('Section title')).toBeTruthy()
    expect(screen.getByText('Section body')).toBeTruthy()
    expect(screen.getByText('Business name')).toBeTruthy()
    expect(screen.getByText('Shown in emails.')).toBeTruthy()
    expect(screen.getByText('Main column')).toBeTruthy()
    expect(screen.getByText('Side rail')).toBeTruthy()
  })

  it('renders dense surfaces and CRM modal primitives for specialized bodies', () => {
    render(
      <div>
        <CrmDenseSurfaceCard title="Dense card" description="Compact section">
          <CrmDenseMetaList
            items={[
              { label: 'Customer', value: 'Alice Jones' },
              { label: 'Stage', value: 'Estimate sent' },
            ]}
          />
          <CrmDenseActionRow>
            <CrmButton>Follow up</CrmButton>
          </CrmDenseActionRow>
        </CrmDenseSurfaceCard>
        <CrmModalShell labelledBy="modal-title" onClose={() => {}}>
          <CrmModalHeader
            eyebrow="Workflow"
            title="Send email"
            description="Shared CRM modal"
            labelledBy="modal-title"
            onClose={() => {}}
            closeLabel="Close modal"
          />
          <CrmModalSection title="Message">
            <div>Modal body</div>
          </CrmModalSection>
        </CrmModalShell>
      </div>
    )

    expect(screen.getByText('Dense card')).toBeTruthy()
    expect(screen.getByText('Compact section')).toBeTruthy()
    expect(screen.getByText('Alice Jones')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Follow up' })).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Send email')).toBeTruthy()
    expect(screen.getByText('Modal body')).toBeTruthy()
  })
})
