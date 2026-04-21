import Link from 'next/link'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { DashboardEmptyState } from './primitives/DashboardEmptyState'
import { DashboardSectionHeader } from './primitives/DashboardSectionHeader'
import { crmBorderStyle, crmMutedTextStyle, crmTextStyle } from './primitives/tokens'

type HomeSearchBoxProps = {
  query: string
  onQueryChange: (value: string) => void
  sections: Array<{
    key: 'customers' | 'jobs'
    label: 'Customers' | 'Jobs'
    items: Array<{
      key: string
      href: string
      title: string
      subtitle: string | null
    }>
  }>
  isOpen: boolean
}

export function HomeSearchBox({
  query,
  onQueryChange,
  sections,
  isOpen,
}: HomeSearchBoxProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [query])

  const showDropdown = isOpen && !dismissed

  return (
    <div className="relative w-full sm:w-72">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={crmMutedTextStyle}
        aria-hidden="true"
      />
      <input
        aria-label="Search customers or jobs"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={() => setDismissed(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDismissed(true)
          }
        }}
        placeholder="Search customers or jobs..."
        className="w-full rounded-xl border py-2.5 pl-8 pr-3 text-sm outline-none transition"
        style={{
          background: 'var(--crm-input)',
          ...crmBorderStyle,
          ...crmTextStyle,
        }}
      />
      {showDropdown ? (
        <DashboardCardShell className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-xl p-3 shadow-xl">
          <div role="listbox" className="grid gap-2">
            {sections.length > 0 ? (
              sections.map((section) => (
                <div key={section.key}>
                  <DashboardSectionHeader
                    label={section.label}
                    className="mb-1"
                    labelClassName="text-[10px]"
                  />
                  {section.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      role="option"
                      className="block rounded-lg px-2.5 py-2 text-sm transition"
                      style={crmTextStyle}
                    >
                      <div className="font-semibold">{item.title}</div>
                      {item.subtitle ? (
                        <div className="text-xs" style={crmMutedTextStyle}>
                          {item.subtitle}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ))
            ) : (
              <DashboardEmptyState message="No results." className="py-0 text-left" />
            )}
          </div>
        </DashboardCardShell>
      ) : null}
    </div>
  )
}
