import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'

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
    <CrmPageShell className="max-w-5xl">
      <CrmPageHeader
        eyebrow={props.eyebrow}
        emoji="⚙️"
        title={props.title}
        description={props.description}
        actions={props.actions}
      />

      {props.children}

      {props.backHref ? (
        <div>
          <Link href={props.backHref} className="ace-crm-btn ace-crm-btn-secondary inline-flex w-fit items-center gap-1.5">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{props.backLabel ?? 'Back'}</span>
          </Link>
        </div>
      ) : null}
    </CrmPageShell>
  )
}
