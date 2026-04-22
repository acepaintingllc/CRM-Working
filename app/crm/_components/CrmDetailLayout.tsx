import type { ReactNode } from 'react'

type CrmDetailLayoutProps = {
  main: ReactNode
  side?: ReactNode
  className?: string
}

export function CrmDetailLayout({ main, side, className = '' }: CrmDetailLayoutProps) {
  return (
    <div className={`grid gap-4 ${side ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''} ${className}`.trim()}>
      <div className="min-w-0 grid gap-4">{main}</div>
      {side ? <aside className="grid content-start gap-4">{side}</aside> : null}
    </div>
  )
}
