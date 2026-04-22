import type { ReactNode } from 'react'

type CrmSectionCardProps = {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  emoji?: string
  eyebrow?: string
  badge?: ReactNode
  actions?: ReactNode
}

export function CrmSectionCard({
  children,
  className = '',
  title,
  description,
  emoji,
  eyebrow,
  badge,
  actions,
}: CrmSectionCardProps) {
  return (
    <section className={`ace-crm-surface px-5 py-5 ${className}`.trim()}>
      {(title || description || actions || eyebrow || badge) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-3xl">
            {(eyebrow || badge) && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {eyebrow ? (
                  <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
                    {eyebrow}
                  </div>
                ) : null}
                {badge}
              </div>
            )}
            {title ? (
              <div className="flex items-center gap-2">
                {emoji ? <span aria-hidden="true" className="text-base">{emoji}</span> : null}
                <h2 className="text-lg font-black tracking-[-0.02em] text-[color:var(--crm-ui-text)]">
                  {title}
                </h2>
              </div>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}
