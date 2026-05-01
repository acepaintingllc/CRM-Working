import { CalendarCheck, Plus, Users, Wrench } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'

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
    <CrmDenseSurfaceCard
      className="crm-quick-actions-card"
      title="Quick actions"
      actions={
        <span className="hidden items-center gap-1.5 text-xs font-bold text-[color:var(--crm-ui-muted)] sm:inline-flex">
          <Plus size={14} aria-hidden="true" />
          Shared CRM actions
        </span>
      }
    >
      <CrmDenseActionRow className="!grid grid-cols-2 items-stretch sm:!flex sm:flex-wrap">
        {viewModel.items.map((item) => (
          <CrmButton
            key={item.href}
            href={item.href}
            tone={item.tone}
            className="!min-h-10 w-full min-w-0 justify-center overflow-hidden px-2 text-sm no-underline sm:w-auto sm:justify-start sm:px-4"
          >
            {actionIcon(item.icon)}
            <span className="truncate">{item.label}</span>
          </CrmButton>
        ))}
      </CrmDenseActionRow>
    </CrmDenseSurfaceCard>
  )
}
