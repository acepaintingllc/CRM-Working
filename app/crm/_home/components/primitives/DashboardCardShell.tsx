import type { ReactNode } from 'react'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'

type DashboardCardShellProps = {
  children: ReactNode
  className?: string
}

export function DashboardCardShell({ children, className }: DashboardCardShellProps) {
  return <CrmDenseSurfaceCard className={className}>{children}</CrmDenseSurfaceCard>
}
