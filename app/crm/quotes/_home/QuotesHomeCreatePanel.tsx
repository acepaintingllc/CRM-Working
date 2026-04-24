'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import {
  QUOTE_VERSION_KIND_OPTIONS,
  type QuoteVersionKind,
} from '@/lib/quotes/versionCreation'
import { QUOTES_HOME_CREATE_PANEL_COPY } from './quoteHomePresentation'
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
      eyebrow={QUOTES_HOME_CREATE_PANEL_COPY.eyebrow}
      title={QUOTES_HOME_CREATE_PANEL_COPY.title}
      description={QUOTES_HOME_CREATE_PANEL_COPY.description}
      actions={
        <CrmButton
          type="button"
          tone="primary"
          onClick={onCreate}
          disabled={!vm.canCreate}
        >
          {vm.creating
            ? QUOTES_HOME_CREATE_PANEL_COPY.creatingButton
            : QUOTES_HOME_CREATE_PANEL_COPY.createButton}
        </CrmButton>
      }
    >
      <div style={S.createFields}>
        <CrmField
          label={QUOTES_HOME_CREATE_PANEL_COPY.versionNameLabel}
          help={QUOTES_HOME_CREATE_PANEL_COPY.versionNameHelp}
        >
          <input
            value={vm.versionName}
            onChange={(event) => onVersionNameChange(event.target.value)}
            placeholder={QUOTES_HOME_CREATE_PANEL_COPY.versionNamePlaceholder}
            className="ace-crm-input text-sm"
          />
        </CrmField>

        <CrmField label={QUOTES_HOME_CREATE_PANEL_COPY.versionKindLabel}>
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
