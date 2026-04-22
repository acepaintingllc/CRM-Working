import type { ReactNode } from 'react'
import { CrmDenseSectionHeader } from '@/app/crm/_components/CrmDenseSectionHeader'

type CrmModalSectionProps = {
  children: ReactNode
  title?: string
  description?: string
  className?: string
  tone?: 'default' | 'muted'
  actions?: ReactNode
  badge?: ReactNode
}

export function CrmModalSection({
  children,
  title,
  description,
  className = '',
  tone = 'default',
  actions,
  badge,
}: CrmModalSectionProps) {
  return (
    <section
      className={`rounded-[18px] border px-4 py-4 ${
        tone === 'muted'
          ? 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-muted-surface)]'
          : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)]'
      } ${className}`.trim()}
    >
      {title ? (
        <CrmDenseSectionHeader
          title={title}
          description={description}
          actions={actions}
          badge={badge}
          className="mb-3"
        />
      ) : null}
      {children}
    </section>
  )
}
