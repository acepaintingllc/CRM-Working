import type { ReactNode } from 'react'

type CrmDenseMetaItem = {
  label: string
  value: ReactNode
  actions?: ReactNode
}

type CrmDenseMetaListProps = {
  items: CrmDenseMetaItem[]
  className?: string
}

export function CrmDenseMetaList({ items, className = '' }: CrmDenseMetaListProps) {
  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      {items.map((item) => (
        <div key={item.label} className="grid gap-1.5">
          <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
            {item.label}
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--crm-ui-text)]">
              {item.value}
            </div>
            {item.actions}
          </div>
        </div>
      ))}
    </div>
  )
}
