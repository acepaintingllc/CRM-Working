'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import {
  FLAGS_SECTIONS,
  RATE_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
  type QuoteRatesActions,
  type QuoteRatesFiltersVm,
  type QuoteRatesTableVm,
} from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import type { RatesFlagsTab } from '@/types/estimator/ratesFlags'
import { getRatesTabLabel } from './quoteRatesPresentation'

type Props = {
  filtersVm: QuoteRatesFiltersVm
  tableVm: Pick<QuoteRatesTableVm, 'activeCategory'>
  actions: Pick<
    QuoteRatesActions,
    'setActiveTab' | 'setRateSection' | 'setRateCategory' | 'setFlagsSection' | 'setRoomDefaultsSection'
  >
}

export function QuoteRatesCategorySection({ filtersVm, tableVm, actions }: Props) {
  return (
    <CrmSectionCard
      title="Configuration sections"
      description={tableVm.activeCategory?.description ?? 'Select a category to edit rows.'}
      actions={
        <>
          {(['rates', 'flags', 'room_defaults'] as RatesFlagsTab[]).map((tab) => (
            <CrmButton
              key={tab}
              type="button"
              tone={filtersVm.activeTab === tab ? 'primary' : 'secondary'}
              onClick={() => actions.setActiveTab(tab)}
            >
              {getRatesTabLabel(tab)}
            </CrmButton>
          ))}
        </>
      }
    >
      <div className="grid gap-3">
        {filtersVm.activeTab === 'rates' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {RATE_SECTIONS.map((section) => (
                <CrmButton
                  key={section.key}
                  type="button"
                  tone={filtersVm.rateSection === section.key ? 'primary' : 'secondary'}
                  onClick={() => actions.setRateSection(section.key)}
                >
                  {section.label}
                </CrmButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RATE_SUBGROUPS[filtersVm.rateSection].map((subgroup) => (
                <CrmButton
                  key={subgroup.key}
                  type="button"
                  tone={filtersVm.rateCategory === subgroup.key ? 'primary' : 'secondary'}
                  onClick={() => actions.setRateCategory(subgroup.key)}
                >
                  {subgroup.label}
                </CrmButton>
              ))}
            </div>
          </>
        ) : filtersVm.activeTab === 'flags' ? (
          <div className="flex flex-wrap gap-2">
            {FLAGS_SECTIONS.map((section) => (
              <CrmButton
                key={section.key}
                type="button"
                tone={filtersVm.flagsSection === section.key ? 'primary' : 'secondary'}
                onClick={() => actions.setFlagsSection(section.key)}
              >
                {section.label}
              </CrmButton>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ROOM_DEFAULTS_SECTIONS.map((section) => (
              <CrmButton
                key={section.key}
                type="button"
                tone={filtersVm.roomDefaultsSection === section.key ? 'primary' : 'secondary'}
                onClick={() => actions.setRoomDefaultsSection(section.key)}
              >
                {section.label}
              </CrmButton>
            ))}
          </div>
        )}
        <div className="text-sm text-[color:var(--crm-ui-muted)]">
          {tableVm.activeCategory?.label ?? 'Loading category metadata...'}
        </div>
      </div>
    </CrmSectionCard>
  )
}
