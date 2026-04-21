import { DashboardSkeletonBlock } from './DashboardSkeletonBlock'

type DashboardSkeletonRowProps = {
  valueClassName?: string
  labelClassName?: string
}

export function DashboardSkeletonRow({
  valueClassName = 'h-8 w-20',
  labelClassName = 'mb-2 h-4 w-16',
}: DashboardSkeletonRowProps) {
  return (
    <div>
      <DashboardSkeletonBlock className={labelClassName} />
      <DashboardSkeletonBlock className={valueClassName} />
    </div>
  )
}
