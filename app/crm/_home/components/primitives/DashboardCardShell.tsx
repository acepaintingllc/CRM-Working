import type { ReactNode } from 'react'
import { cx } from './utils'

type DashboardCardShellProps = {
  children: ReactNode
  className?: string
}

export function DashboardCardShell({ children, className }: DashboardCardShellProps) {
  return <div className={cx('crm-card rounded-2xl border shadow-sm', className)}>{children}</div>
}
