import type { ReactNode } from 'react'

type CrmEmptyStateProps = {
  title: string
  description: string
  emoji?: string
  action?: ReactNode
  className?: string
}

export function CrmEmptyState({
  title,
  description,
  emoji,
  action,
  className = '',
}: CrmEmptyStateProps) {
  return (
    <div
      className={`ace-crm-surface-muted flex flex-col items-start gap-3 border-dashed px-4 py-4 ${className}`.trim()}
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
