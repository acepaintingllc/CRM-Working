import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

type SettingsPageShellProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  backHref?: string
  backLabel?: string
  actions?: ReactNode
}

export function SettingsPageShell(props: SettingsPageShellProps) {
  return (
    <div className="min-h-full bg-slate-50 py-4 md:py-6">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 md:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            {props.eyebrow}
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-950">{props.title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{props.description}</p>
            </div>
            {props.actions}
          </div>
        </section>

        {props.children}

        {props.backHref ? (
          <Link
            href={props.backHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 no-underline shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{props.backLabel ?? 'Back'}</span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
