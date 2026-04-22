'use client'

import { Boxes } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { QuoteProductsPageContent } from '@/app/crm/quotes/_products/QuoteProductsPageContent'

export default function QuoteProductsPage() {
  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="📦"
        title="Quote Products"
        description="Dense admin editor for quote paint and primer catalog rows."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<Boxes size={16} aria-hidden="true" />}
      />

      <QuoteProductsPageContent />
    </CrmPageShell>
  )
}
