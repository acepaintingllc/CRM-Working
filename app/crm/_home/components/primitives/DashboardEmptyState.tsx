import { crmMutedTextStyle } from './tokens'
import { cx } from './utils'

type DashboardEmptyStateProps = {
  message: string
  className?: string
}

export function DashboardEmptyState({ message, className }: DashboardEmptyStateProps) {
  return (
    <div className={cx('py-8 text-center text-sm', className)} style={crmMutedTextStyle}>
      {message}
    </div>
  )
}
