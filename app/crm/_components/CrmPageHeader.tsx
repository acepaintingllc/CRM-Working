import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { crmButtonClassName } from '@/app/crm/_components/crmStyles'

type CrmPageHeaderProps = {
  title: string
  description?: string
  eyebrow?: string
  emoji?: string
  badge?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  backHref?: string
  backLabel?: string
  backAction?: ReactNode
}

export function CrmPageHeader({
  title,
  description,
  eyebrow,
  emoji,
  badge,
  actions,
  meta,
  backHref,
  backLabel = 'Back',
  backAction,
}: CrmPageHeaderProps) {
  return (
    <section className="ace-crm-surface overflow-hidden px-5 py-5 md:px-6 md:py-6">
      {backAction ? <div className="mb-4">{backAction}</div> : null}
      {!backAction && backHref ? (
        <div className="mb-4">
          <Link
            href={backHref}
            className={`${crmButtonClassName('secondary')} inline-flex w-fit items-center gap-1.5 no-underline`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        </div>
      ) : null}
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
              {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
