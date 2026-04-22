import type { ReactNode } from 'react'

type CrmFormActionsProps = {
  children: ReactNode
  className?: string
}

export function CrmFormActions({ children, className = '' }: CrmFormActionsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      {children}
    </div>
  )
}
