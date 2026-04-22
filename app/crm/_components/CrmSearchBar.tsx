import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

type CrmSearchBarProps = {
  value: string
  onChange: (nextValue: string) => void
  placeholder: string
  className?: string
  actions?: ReactNode
}

export function CrmSearchBar({
  value,
  onChange,
  placeholder,
  className = '',
  actions,
}: CrmSearchBarProps) {
  return (
    <div className={`ace-crm-surface flex flex-wrap items-center gap-3 px-4 py-3 ${className}`.trim()}>
      <label className="relative flex min-w-0 flex-1 items-center gap-3">
        <Search size={16} aria-hidden="true" className="text-[color:var(--crm-ui-muted-2)]" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent p-0 text-sm text-[color:var(--crm-ui-text)] outline-none placeholder:text-[color:var(--crm-ui-muted-2)]"
        />
      </label>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
