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
  variant?: 'default' | 'compact' | 'rail' | 'interactive'
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
  variant = 'default',
}: CrmSectionCardProps) {
  const spacingClassName =
    variant === 'compact'
      ? 'px-4 py-4'
      : variant === 'rail'
        ? 'px-4 py-5'
        : 'px-5 py-5'
  const variantClassName =
    variant === 'interactive'
      ? 'transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--crm-ui-accent-border)] hover:shadow-[0_22px_52px_rgba(17,24,39,0.10)]'
      : ''

  return (
    <section className={`ace-crm-surface ${spacingClassName} ${variantClassName} ${className}`.trim()}>
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
