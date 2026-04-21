import { cx } from './utils'

type DashboardSkeletonBlockProps = {
  className: string
}

export function DashboardSkeletonBlock({ className }: DashboardSkeletonBlockProps) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-slate-200/70', className)} />
}
