'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import {
  QUOTE_VERSION_KIND_OPTIONS,
  type QuoteVersionKind,
} from '@/lib/quotes/versionCreation'
import type { QuotesHomeCreateVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  vm: QuotesHomeCreateVm
  onCreate: () => void
  onVersionKindChange: (value: QuoteVersionKind) => void
  onVersionNameChange: (value: string) => void
}

export function QuotesHomeCreatePanel({
  vm,
  onCreate,
  onVersionKindChange,
  onVersionNameChange,
}: Props) {
  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Create Version"
      title="Add the next quote version"
      description="Creates a new quote version linked to this job, then opens it in the workspace."
      actions={
        <CrmButton
          type="button"
          tone="primary"
          onClick={onCreate}
          disabled={!vm.canCreate}
        >
          {vm.creating ? 'Creating version...' : 'Create version'}
        </CrmButton>
      }
    >
      <div style={S.createFields}>
        <CrmField
          label="Version Name"
          help="Leave blank for the next default version name."
        >
          <input
            value={vm.versionName}
            onChange={(event) => onVersionNameChange(event.target.value)}
            placeholder="Leave blank for the next default version name"
            className="ace-crm-input text-sm"
          />
        </CrmField>

        <CrmField label="Version Kind">
          <select
            value={vm.versionKind}
            onChange={(event) =>
              onVersionKindChange(event.target.value as QuoteVersionKind)
            }
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
