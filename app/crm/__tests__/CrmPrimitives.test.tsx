import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

describe('CRM primitives', () => {
  it('renders the header with emoji, eyebrow, description, and actions', () => {
    render(
      <CrmPageShell>
        <CrmPageHeader
          eyebrow="Operations"
          emoji="🧭"
          title="Customers"
          description="Manage customer records."
          actions={<CrmButton>Action</CrmButton>}
        />
      </CrmPageShell>
    )

    expect(screen.getByText('Customers')).toBeTruthy()
    expect(screen.getByText('Manage customer records.')).toBeTruthy()
    expect(screen.getByText('Operations')).toBeTruthy()
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

  it('keeps section cards inside the CRM shell structure', () => {
    render(
      <CrmPageShell>
        <CrmSectionCard title="Section title" description="Section body">
          <div>Content</div>
        </CrmSectionCard>
      </CrmPageShell>
    )

    expect(screen.getByText('Section title')).toBeTruthy()
    expect(screen.getByText('Section body')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
  })
})
