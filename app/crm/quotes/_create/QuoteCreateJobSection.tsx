'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

type QuoteCreateJobSectionProps = {
  title: string
  customerLine: string | null
  jobHref: string | null
}

export function QuoteCreateJobSection({ title, customerLine, jobHref }: QuoteCreateJobSectionProps) {
  return (
    <CrmSectionCard
      eyebrow="Selected Job"
      title={title}
      description={customerLine ?? 'No eligible job is loaded for this quote creation flow.'}
      actions={jobHref ? <CrmButton href={jobHref}>Open job</CrmButton> : null}
    >
      <div className="text-sm text-[color:var(--crm-ui-muted)]">
        Quote versions are created against the selected job and opened in the quote workspace after creation.
      </div>
    </CrmSectionCard>
  )
}
