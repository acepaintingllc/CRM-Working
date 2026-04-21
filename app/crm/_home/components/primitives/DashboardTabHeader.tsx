import Link from 'next/link'
import { crmBorderStyle, crmMutedTextStyle } from './tokens'
import { cx } from './utils'

type DashboardTabItem =
  | {
      key: string
      label: string
      type: 'button'
      panelId: string
    }
  | {
      key: string
      label: string
      type: 'link'
      panelId: string
      href: string
    }

type DashboardTabHeaderProps = {
  label: string
  activeKey: string
  items: DashboardTabItem[]
  onSelect: (key: string) => void
  tabIds: Record<string, string>
}

function activeTabStyles(isActive: boolean) {
  return isActive
    ? { background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }
    : crmMutedTextStyle
}

export function DashboardTabHeader({
  label,
  activeKey,
  items,
  onSelect,
  tabIds,
}: DashboardTabHeaderProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex items-center gap-3 border-b px-5 pt-5 pb-3"
      style={crmBorderStyle}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey
        const className = cx(
          'rounded-lg px-3 py-1.5 text-sm',
          isActive ? 'font-extrabold' : 'font-semibold'
        )

        if (item.type === 'link') {
          return (
            <Link
              key={item.key}
              href={item.href}
              role="tab"
              aria-selected={false}
              aria-controls={item.panelId}
              id={tabIds[item.key]}
              className={className}
              style={activeTabStyles(false)}
            >
              {item.label}
            </Link>
          )
        }

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={tabIds[item.key]}
            aria-selected={isActive}
            aria-controls={item.panelId}
            onClick={() => onSelect(item.key)}
            className={className}
            style={activeTabStyles(isActive)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
