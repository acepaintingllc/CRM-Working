import type { ReactNode } from 'react'

type CrmPageShellProps = {
  children: ReactNode
  className?: string
}

export function CrmPageShell({ children, className = '' }: CrmPageShellProps) {
  return (
    <div className="ace-crm-shell min-h-full py-4 md:py-6">
      <div className={`mx-auto grid max-w-6xl gap-4 px-4 md:px-6 ${className}`.trim()}>{children}</div>
    </div>
  )
}
