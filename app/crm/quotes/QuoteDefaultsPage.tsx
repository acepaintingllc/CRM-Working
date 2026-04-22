'use client'

import { SlidersHorizontal } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { QuoteDefaultsPageContent } from '@/app/crm/quotes/_defaults/QuoteDefaultsPageContent'

export default function QuoteDefaultsPage() {
  return (
    <CrmPageShell className="max-w-5xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="🧰"
        title="Quote Defaults"
        description="Org-level defaults for new quotes. Quote validity and terms stay on the send settings page."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<SlidersHorizontal size={16} aria-hidden="true" />}
      />

      <QuoteDefaultsPageContent />
    </CrmPageShell>
  )
}
