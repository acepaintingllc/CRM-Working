import type { ReactNode } from 'react'

type SettingsSectionCardProps = {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSectionCard(props: SettingsSectionCardProps) {
  return (
    <section className="ace-crm-surface p-5">
      <div className="mb-4">
        <h2 className="text-lg font-black text-[color:var(--crm-ui-text)]">{props.title}</h2>
        {props.description ? (
          <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">{props.description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{props.children}</div>
    </section>
  )
}
