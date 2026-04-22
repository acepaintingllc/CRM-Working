export type CrmButtonTone = 'primary' | 'secondary' | 'danger'

export type CrmChipTone = 'default' | 'accent' | 'success' | 'warning' | 'danger'

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function crmButtonClassName(
  tone: CrmButtonTone = 'secondary',
  className?: string
) {
  return joinClassNames(
    'ace-crm-btn',
    tone === 'primary' && 'ace-crm-btn-primary',
    tone === 'secondary' && 'ace-crm-btn-secondary',
    tone === 'danger' && 'ace-crm-btn-danger',
    className
  )
}

export function crmChipClassName(tone: CrmChipTone = 'default', className?: string) {
  return joinClassNames(
    'ace-crm-chip',
    tone === 'accent' &&
      'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)] text-[color:var(--crm-ui-accent)]',
    tone === 'success' &&
      'border-[color:var(--crm-ui-success-border)] bg-[color:var(--crm-ui-success-bg)] text-[color:var(--crm-ui-success-text)]',
    tone === 'warning' &&
      'border-[color:var(--crm-ui-warning-border)] bg-[color:var(--crm-ui-warning-bg)] text-[color:var(--crm-ui-warning-text)]',
    tone === 'danger' &&
      'border-[color:var(--crm-ui-danger-border)] bg-[color:var(--crm-ui-danger-bg)] text-[color:var(--crm-ui-danger-text)]',
    className
  )
}

export function crmInputClassName(className?: string) {
  return joinClassNames('ace-crm-input', className)
}

export function crmSurfaceClassName(className?: string) {
  return joinClassNames('ace-crm-surface', className)
}

export function crmSurfaceMutedClassName(className?: string) {
  return joinClassNames('ace-crm-surface-muted', className)
}
