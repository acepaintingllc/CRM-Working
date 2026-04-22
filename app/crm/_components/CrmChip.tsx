import type { ReactNode } from 'react'
import { crmChipClassName, type CrmChipTone } from '@/app/crm/_components/crmStyles'

type CrmChipProps = {
  children: ReactNode
  tone?: CrmChipTone
  emoji?: string
  className?: string
}

export function CrmChip({ children, tone = 'default', emoji, className }: CrmChipProps) {
  return (
    <span className={crmChipClassName(tone, className)}>
      {emoji ? <span aria-hidden="true">{emoji}</span> : null}
      <span>{children}</span>
    </span>
  )
}
