import type { ReactNode } from 'react'

type CrmPageHeaderProps = {
  title: string
  description?: string
  eyebrow?: string
  emoji?: string
  badge?: ReactNode
  actions?: ReactNode
}

export function CrmPageHeader({
  title,
  description,
  eyebrow,
  emoji,
  badge,
  actions,
}: CrmPageHeaderProps) {
  return (
    <section className="ace-crm-surface overflow-hidden px-5 py-5 md:px-6 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {(eyebrow || badge) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
                  {eyebrow}
                </div>
              ) : null}
              {badge}
            </div>
          )}
          <div className="flex items-start gap-3">
            {emoji ? (
              <div className="ace-crm-surface-muted flex h-11 w-11 shrink-0 items-center justify-center text-xl">
                <span aria-hidden="true">{emoji}</span>
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[1.9rem] font-black tracking-[-0.03em] text-[color:var(--crm-ui-text)]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
