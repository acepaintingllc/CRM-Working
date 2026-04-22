import type { ReactNode } from 'react'

type CrmModalShellProps = {
  children: ReactNode
  labelledBy: string
  onClose: () => void
  widthClassName?: string
}

export function CrmModalShell({
  children,
  labelledBy,
  onClose,
  widthClassName = 'max-w-3xl',
}: CrmModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`ace-crm-surface w-full ${widthClassName} max-h-[88vh] overflow-hidden`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
