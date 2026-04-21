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
      <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">
        {props.label}
      </span>
      {props.children}
      {props.error ? (
        <span className="text-xs text-red-600">{props.error}</span>
      ) : props.help ? (
        <span className="text-xs text-slate-500">{props.help}</span>
      ) : null}
    </label>
  )
}
