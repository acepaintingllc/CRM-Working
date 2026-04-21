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
      <div className="inline-flex items-center gap-2 text-base font-extrabold text-slate-950">
        <props.Icon size={18} aria-hidden="true" />
        <span>{props.title}</span>
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.description}</div>
    </>
  )

  const className =
    'block rounded-xl border border-slate-200 bg-white p-4 no-underline shadow-sm transition hover:border-slate-300 hover:bg-slate-50'

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
