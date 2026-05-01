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
  className?: string
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
  className = '',
}: CrmPageHeaderProps) {
  return (
    <section className={`ace-crm-surface overflow-hidden px-3 py-3 sm:px-4 md:px-6 md:py-6 ${className}`.trim()}>
      {backAction ? <div className="mb-3 md:mb-4">{backAction}</div> : null}
      {!backAction && backHref ? (
        <div className="mb-3 md:mb-4">
          <Link
            href={backHref}
            className={`${crmButtonClassName('secondary')} inline-flex min-h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-xs no-underline sm:min-h-11 sm:px-4 sm:text-sm`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3 md:gap-4">
        <div className="min-w-0 max-w-3xl">
          {(eyebrow || badge) && (
            <div className="mb-2 flex flex-wrap items-center gap-2 md:mb-3">
              {eyebrow ? (
                <div className="ace-crm-mono text-[9px] font-bold text-[color:var(--crm-ui-muted)] sm:text-[11px]">
                  {eyebrow}
                </div>
              ) : null}
              {badge}
            </div>
          )}
          <div className="flex items-start gap-2.5 md:gap-3">
            {emoji ? (
              <div className="ace-crm-surface-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base md:h-11 md:w-11 md:text-xl">
                <span aria-hidden="true">{emoji}</span>
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[1.35rem] font-black leading-tight tracking-normal text-[color:var(--crm-ui-text)] sm:text-[1.55rem] md:text-[1.9rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-[color:var(--crm-ui-muted)] sm:block">
                  {description}
                </p>
              ) : null}
              {meta ? <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-3">{meta}</div> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
      </div>
    </section>
  )
}
