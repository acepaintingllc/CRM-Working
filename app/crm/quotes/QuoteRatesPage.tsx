'use client'

import { Calculator } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { QuoteRatesPageContent } from '@/app/crm/quotes/_rates/QuoteRatesPageContent'

export default function QuoteRatesPage() {
  return (
    <CrmPageShell className="max-w-7xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="📐"
        title="Rates, Flags, Room Defaults, and Assumptions"
        description="Dense admin editor for estimator configuration. This remains an intentional exception, but now uses standard CRM shells and resource states."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<Calculator size={16} aria-hidden="true" />}
      />

      <QuoteRatesPageContent />
    </CrmPageShell>
  )
}
