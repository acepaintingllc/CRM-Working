import type { ReactNode } from 'react'
import { crmBorderStyle } from './tokens'
import { cx } from './utils'

type DashboardDividedListProps = {
  children: ReactNode
  className?: string
}

export function DashboardDividedList({ children, className }: DashboardDividedListProps) {
  return (
    <div className={cx('divide-y', className)} style={crmBorderStyle}>
      {children}
    </div>
  )
}
