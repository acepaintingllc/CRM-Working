'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import {
  FLAGS_SECTIONS,
  RATE_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
  useQuoteRatesPage,
} from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import type { RatesFlagsTab } from '@/types/estimator/ratesFlags'
import { getRatesTabLabel } from './quoteRatesPresentation'

type QuoteRatesController = ReturnType<typeof useQuoteRatesPage>

export function QuoteRatesCategorySection({
  controller,
}: {
  controller: QuoteRatesController
}) {
  return (
    <CrmSectionCard
      title="Configuration sections"
      description={controller.tableVm.activeCategory?.description ?? 'Select a category to edit rows.'}
      actions={
        <>
          {(['rates', 'flags', 'room_defaults'] as RatesFlagsTab[]).map((tab) => (
            <CrmButton
              key={tab}
              type="button"
              tone={controller.filtersVm.activeTab === tab ? 'primary' : 'secondary'}
              onClick={() => controller.actions.setActiveTab(tab)}
            >
              {getRatesTabLabel(tab)}
            </CrmButton>
          ))}
        </>
      }
    >
      <div className="grid gap-3">
        {controller.filtersVm.activeTab === 'rates' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {RATE_SECTIONS.map((section) => (
                <CrmButton
                  key={section.key}
                  type="button"
                  tone={controller.filtersVm.rateSection === section.key ? 'primary' : 'secondary'}
                  onClick={() => {
                    controller.actions.setRateSection(section.key)
                    controller.actions.setRateCategory(RATE_SUBGROUPS[section.key][0].key)
                  }}
                >
                  {section.label}
                </CrmButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RATE_SUBGROUPS[controller.filtersVm.rateSection].map((subgroup) => (
                <CrmButton
                  key={subgroup.key}
                  type="button"
                  tone={controller.filtersVm.rateCategory === subgroup.key ? 'primary' : 'secondary'}
                  onClick={() => controller.actions.setRateCategory(subgroup.key)}
                >
                  {subgroup.label}
                </CrmButton>
              ))}
            </div>
          </>
        ) : controller.filtersVm.activeTab === 'flags' ? (
          <div className="flex flex-wrap gap-2">
            {FLAGS_SECTIONS.map((section) => (
              <CrmButton
                key={section.key}
                type="button"
                tone={controller.filtersVm.flagsSection === section.key ? 'primary' : 'secondary'}
                onClick={() => controller.actions.setFlagsSection(section.key)}
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
                tone={controller.filtersVm.roomDefaultsSection === section.key ? 'primary' : 'secondary'}
                onClick={() => controller.actions.setRoomDefaultsSection(section.key)}
              >
                {section.label}
              </CrmButton>
            ))}
          </div>
        )}
        <div className="text-sm text-[color:var(--crm-ui-muted)]">
          {controller.tableVm.activeCategory?.label ?? 'Loading category metadata...'}
        </div>
      </div>
    </CrmSectionCard>
  )
}
