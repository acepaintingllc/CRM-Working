import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type SettingsNavTileProps = {
  href?: string
  title: string
  description: string
  Icon: LucideIcon
  planned?: boolean
}

export function SettingsNavTile(props: SettingsNavTileProps) {
  const content = (
    <>
      <div className="inline-flex items-center gap-2 text-base font-extrabold text-[color:var(--crm-ui-text)]">
        <props.Icon size={18} aria-hidden="true" />
        <span>{props.title}</span>
      </div>
      <div className="mt-2 text-sm leading-6 text-[color:var(--crm-ui-muted)]">{props.description}</div>
    </>
  )

  const className =
    'ace-crm-surface block rounded-[var(--crm-ui-radius-sm)] p-4 no-underline transition hover:-translate-y-0.5 hover:border-[color:var(--crm-ui-accent-border)] hover:bg-[color:var(--crm-ui-surface-strong)]'

  if (!props.href || props.planned) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <Link href={props.href} className={className}>
      {content}
    </Link>
  )
}
