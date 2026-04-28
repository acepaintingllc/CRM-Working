import { X } from 'lucide-react'

type CrmModalHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  labelledBy: string
  onClose: () => void
  closeLabel: string
}

export function CrmModalHeader({
  eyebrow,
  title,
  description,
  labelledBy,
  onClose,
  closeLabel,
}: CrmModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--crm-ui-border)] px-5 py-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
            {eyebrow}
          </div>
        ) : null}
        <h2 id={labelledBy} className="mt-1 text-xl font-black tracking-[-0.02em] text-[color:var(--crm-ui-text)]">
          {title}
        </h2>
        {description ? (
          <div className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ace-crm-btn ace-crm-btn-secondary crm-modal-close-button size-12 shrink-0 justify-center px-0"
        aria-label={closeLabel}
      >
        <X size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
