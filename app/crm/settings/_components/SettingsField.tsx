import type { ReactNode } from 'react'

type SettingsFieldProps = {
  label: string
  help?: string
  error?: string | null
  children: ReactNode
}

export function SettingsField(props: SettingsFieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
        {props.label}
      </span>
      {props.children}
      {props.error ? (
        <span className="text-xs text-[color:var(--crm-ui-danger-text)]">{props.error}</span>
      ) : props.help ? (
        <span className="text-xs text-[color:var(--crm-ui-muted)]">{props.help}</span>
      ) : null}
    </label>
  )
}
