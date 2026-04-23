'use client'

import { FilePlus2 } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { QuoteCreatePageContent } from '@/app/crm/quotes/_create/QuoteCreatePageContent'

export default function QuoteCreatePage() {
  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="🧾"
        title="Create Quote"
        description="Create the next quote version for a selected job using the shared quote admin structure."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<FilePlus2 size={16} aria-hidden="true" />}
      />

      <QuoteCreatePageContent />
    </CrmPageShell>
  )
}
