'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { QuotesHomeCreateVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  vm: QuotesHomeCreateVm
  onCreate: () => void | Promise<unknown>
  onVersionKindChange: (value: QuotesHomeCreateVm['versionKind']) => void
  onVersionNameChange: (value: string) => void
}

export function QuotesHomeCreatePanel({
  vm,
  onCreate,
  onVersionKindChange,
  onVersionNameChange,
}: Props) {
  const disabledReasonId = vm.disabledReason
    ? 'quote-home-create-disabled-reason'
    : undefined

  return (
    <CrmSectionCard
      className="self-start"
      eyebrow={vm.eyebrow}
      title={vm.title}
      description={vm.description}
      actions={
        <CrmButton
          type="button"
          tone="primary"
          onClick={() => void onCreate()}
          disabled={!vm.canCreate}
          aria-busy={vm.creating || undefined}
          aria-describedby={disabledReasonId}
        >
          {vm.createButtonLabel}
        </CrmButton>
      }
    >
      <div style={S.createFields}>
        <CrmField
          label={vm.versionNameLabel}
          help={vm.versionNameHelp}
        >
          <input
            value={vm.versionName}
            onChange={(event) => onVersionNameChange(event.target.value)}
            placeholder={vm.versionNamePlaceholder}
            className="ace-crm-input text-sm"
          />
        </CrmField>

        <CrmField label={vm.versionKindLabel}>
          <select
            value={vm.versionKind}
            onChange={(event) =>
              onVersionKindChange(
                event.target.value as QuotesHomeCreateVm['versionKind']
              )
            }
            className="ace-crm-input text-sm"
          >
            {vm.versionKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CrmField>

        {vm.disabledReason ? (
          <div id={disabledReasonId} style={S.mutedText}>
            {vm.disabledReason}
          </div>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
