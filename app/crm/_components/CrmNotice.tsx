import type { ReactNode } from 'react'

type CrmNoticeTone = 'error' | 'success' | 'info' | 'warning'

type CrmNoticeProps = {
  tone: CrmNoticeTone
  title?: string
  emoji?: string
  children: ReactNode
  compact?: boolean
}

const toneClassName: Record<CrmNoticeTone, string> = {
  error:
    'border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] text-[color:var(--crm-ui-danger-text)]',
  success:
    'border-[color:var(--crm-ui-success-border)] bg-[color:var(--crm-ui-success-bg)] text-[color:var(--crm-ui-success-text)]',
  info: 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] text-[color:var(--crm-ui-text)]',
  warning:
    'border-[color:var(--crm-ui-warning-border)] bg-[color:var(--crm-ui-warning-bg)] text-[color:var(--crm-ui-warning-text)]',
}

export function CrmNotice({ tone, title, emoji, children, compact = false }: CrmNoticeProps) {
  return (
    <div
      className={`rounded-2xl border text-sm shadow-sm ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} ${toneClassName[tone]}`}
    >
      <div className="flex items-start gap-3">
        {emoji ? (
          <div className="mt-0.5 text-base" aria-hidden="true">
            {emoji}
          </div>
        ) : null}
        <div className="min-w-0">
          {title ? <div className="font-black">{title}</div> : null}
          <div className={title ? 'mt-1' : ''}>{children}</div>
        </div>
      </div>
    </div>
  )
}
