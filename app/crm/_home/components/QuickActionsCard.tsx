import Link from 'next/link'
import { CalendarCheck, Plus, Users, Wrench } from 'lucide-react'

type QuickActionsCardProps = {
  viewModel: {
    items: Array<{
      href: string
      label: string
      icon: 'calendar' | 'plus' | 'users' | 'wrench'
      tone: 'primary' | 'secondary'
    }>
  }
}

function actionIcon(icon: 'calendar' | 'plus' | 'users' | 'wrench') {
  if (icon === 'calendar') return <CalendarCheck size={13} aria-hidden="true" />
  if (icon === 'wrench') return <Wrench size={13} aria-hidden="true" />
  if (icon === 'plus') return <Plus size={13} aria-hidden="true" />
  return <Users size={13} aria-hidden="true" />
}

export function QuickActionsCard({ viewModel }: QuickActionsCardProps) {
  return (
    <div className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
        <Plus size={15} aria-hidden="true" />
        Quick actions
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {viewModel.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm transition sm:justify-start sm:py-2 ${
              item.tone === 'primary'
                ? 'font-extrabold transition-transform hover:scale-[1.02]'
                : 'border font-semibold'
            }`}
            style={
              item.tone === 'primary'
                ? { background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }
                : {
                    borderColor: 'var(--crm-border)',
                    background: 'var(--crm-button)',
                    color: 'var(--crm-button-text)',
                  }
            }
          >
            {actionIcon(item.icon)}
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
