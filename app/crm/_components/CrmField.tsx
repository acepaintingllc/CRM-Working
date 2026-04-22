import type { ReactNode } from 'react'

type CrmFieldProps = {
  label: string
  help?: string
  error?: string | null
  children: ReactNode
}

export function CrmField({ label, help, error, children }: CrmFieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-[color:var(--crm-ui-danger-text)]">{error}</span>
      ) : help ? (
        <span className="text-xs text-[color:var(--crm-ui-muted)]">{help}</span>
      ) : null}
    </label>
  )
}
