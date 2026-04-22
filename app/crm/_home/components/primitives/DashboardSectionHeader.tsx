import Link from 'next/link'
import type { ReactNode } from 'react'
import { CrmDenseSectionHeader } from '@/app/crm/_components/CrmDenseSectionHeader'
import { crmMutedTextStyle } from './tokens'

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
  labelClassName = '',
}: DashboardSectionHeaderProps) {
  return (
    <CrmDenseSectionHeader
      title={label}
      badge={badge}
      className={[className, labelClassName].filter(Boolean).join(' ')}
      actions={
        actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={crmMutedTextStyle}
          >
            {actionLabel}
          </Link>
        ) : null
      }
    />
  )
}
