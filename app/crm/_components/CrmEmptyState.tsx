import type { ReactNode } from 'react'

type CrmEmptyStateProps = {
  title: string
  description: string
  emoji?: string
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function CrmEmptyState({
  title,
  description,
  emoji,
  action,
  className = '',
  compact = false,
}: CrmEmptyStateProps) {
  return (
    <div
      className={`ace-crm-surface-muted flex flex-col items-start border-dashed ${compact ? 'gap-2 px-3 py-3' : 'gap-3 px-4 py-4'} ${className}`.trim()}
    >
      {emoji ? (
        <div className="text-2xl" aria-hidden="true">
          {emoji}
        </div>
      ) : null}
      <div>
        <div className="text-sm font-black text-[color:var(--crm-ui-text)]">{title}</div>
        <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">{description}</p>
      </div>
      {action}
    </div>
  )
}
