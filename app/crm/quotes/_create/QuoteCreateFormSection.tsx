'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { QUOTE_VERSION_KIND_OPTIONS, type QuoteVersionKind } from '@/lib/quotes/versionCreation'

type QuoteCreateFormSectionProps = {
  versionName: string
  versionKind: QuoteVersionKind
  creating: boolean
  canCreate: boolean
  onCreate: () => void
  onVersionNameChange: (value: string) => void
  onVersionKindChange: (value: QuoteVersionKind) => void
}

export function QuoteCreateFormSection({
  versionName,
  versionKind,
  creating,
  canCreate,
  onCreate,
  onVersionKindChange,
  onVersionNameChange,
}: QuoteCreateFormSectionProps) {
  return (
    <CrmSectionCard
      eyebrow="New Version"
      title="Add the next quote version"
      description="Creates a new quote version linked to this job, then opens it in the workspace."
      actions={
        <CrmButton type="button" tone="primary" onClick={onCreate} disabled={!canCreate}>
          {creating ? 'Creating version...' : 'Create version'}
        </CrmButton>
      }
    >
      <div className="grid gap-4">
        <CrmField label="Version Name" help="Leave blank for default name.">
          <input
            value={versionName}
            onChange={(event) => onVersionNameChange(event.target.value)}
            placeholder="Leave blank for default name"
            className="ace-crm-input text-sm"
          />
        </CrmField>

        <CrmField label="Version Kind">
          <select
            value={versionKind}
            onChange={(event) => onVersionKindChange(event.target.value as QuoteVersionKind)}
            className="ace-crm-input text-sm"
          >
            {QUOTE_VERSION_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CrmField>
      </div>
    </CrmSectionCard>
  )
}
