import Link from 'next/link'
import type { ReactNode } from 'react'
import { crmMutedTextStyle } from './tokens'
import { cx } from './utils'

type DashboardSectionHeaderProps = {
  label: string
  actionHref?: string
  actionLabel?: string
  badge?: ReactNode
  className?: string
  labelClassName?: string
}

export function DashboardSectionHeader({
  label,
  actionHref,
  actionLabel,
  badge,
  className,
  labelClassName,
}: DashboardSectionHeaderProps) {
  return (
    <div className={cx('flex items-center justify-between', className)}>
      <div className="flex items-center gap-1.5">
        <div
          className={cx('text-[11px] font-extrabold uppercase tracking-widest', labelClassName)}
          style={crmMutedTextStyle}
        >
          {label}
        </div>
        {badge}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="text-xs font-semibold underline-offset-2 hover:underline"
          style={crmMutedTextStyle}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
