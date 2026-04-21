import type { ReactNode } from 'react'

type SettingsNoticeProps = {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}

const toneClasses: Record<SettingsNoticeProps['tone'], string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function SettingsNotice(props: SettingsNoticeProps) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${toneClasses[props.tone]}`}>
      {props.children}
    </div>
  )
}
