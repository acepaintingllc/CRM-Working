import type { ReactNode } from 'react'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { crmMutedTextStyle, crmTextStyle } from './primitives/tokens'

type HomeTopBarProps = {
  todayLabel: string
  greeting: string
  searchBox: ReactNode
}

export function HomeTopBar(props: HomeTopBarProps) {
  const { todayLabel, greeting, searchBox } = props
  return (
    <DashboardCardShell className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-widest" style={crmMutedTextStyle}>
          {todayLabel}
        </div>
        <h1 className="mt-0.5 text-xl font-extrabold md:text-2xl" style={crmTextStyle}>
          {greeting}
        </h1>
      </div>

      {searchBox}
    </DashboardCardShell>
  )
}
