'use client'

import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { QuoteAdminPageBanner as QuoteAdminPageBannerVm } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'

type Props = {
  banner: QuoteAdminPageBannerVm | null
}

export function QuoteAdminPageBanner({ banner }: Props) {
  if (!banner) return null

  return (
    <CrmNotice tone={banner.tone} title={banner.title}>
      {banner.message}
    </CrmNotice>
  )
}
