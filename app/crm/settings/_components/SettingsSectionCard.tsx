import type { ReactNode } from 'react'

type SettingsSectionCardProps = {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSectionCard(props: SettingsSectionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-950">{props.title}</h2>
        {props.description ? (
          <p className="mt-1 text-sm text-slate-600">{props.description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{props.children}</div>
    </section>
  )
}
