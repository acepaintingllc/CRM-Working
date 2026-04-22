import type { ReactNode } from 'react'
import { crmSurfaceClassName, crmSurfaceMutedClassName } from '@/app/crm/_components/crmStyles'
import { CrmDenseSectionHeader } from '@/app/crm/_components/CrmDenseSectionHeader'

type CrmDenseSurfaceCardProps = {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  tone?: 'default' | 'muted'
  interactive?: boolean
}

export function CrmDenseSurfaceCard({
  children,
  className = '',
  title,
  description,
  badge,
  actions,
  tone = 'default',
  interactive = false,
}: CrmDenseSurfaceCardProps) {
  const baseClassName = tone === 'muted' ? crmSurfaceMutedClassName() : crmSurfaceClassName()
  const interactiveClassName = interactive
    ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(17,24,39,0.10)]'
    : ''

  return (
    <div className={`${baseClassName} rounded-[18px] px-4 py-4 ${interactiveClassName} ${className}`.trim()}>
      {title ? (
        <CrmDenseSectionHeader
          title={title}
          description={description}
          badge={badge}
          actions={actions}
          className="mb-3"
        />
      ) : null}
      {children}
    </div>
  )
}
