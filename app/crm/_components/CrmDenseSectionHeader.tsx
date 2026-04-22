import type { ReactNode } from 'react'

type CrmDenseSectionHeaderProps = {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CrmDenseSectionHeader({
  title,
  description,
  badge,
  actions,
  className = '',
}: CrmDenseSectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black tracking-[-0.01em] text-[color:var(--crm-ui-text)]">
            {title}
          </h3>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[color:var(--crm-ui-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
