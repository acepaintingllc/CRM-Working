import type { EstimateV2DetailsVm } from '../_lib/estimateV2DetailsVm'

const metricClassName =
  'ace-crm-surface-muted min-w-0 rounded-xl px-4 py-3'
const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

export function EstimateV2DetailsMaterialOverview({
  materialCards,
}: {
  materialCards: EstimateV2DetailsVm['materialCards']
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {materialCards.map((item) => (
        <div
          key={item.label}
          className={`${metricClassName} ${item.overridden ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]' : ''}`}
        >
          <div className={labelClassName}>{item.label}</div>
          <div className="mt-2 text-2xl font-black text-[color:var(--crm-ui-text)]">
            {item.finalValue}
          </div>
          <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
            {item.calculatedValue}
          </div>
        </div>
      ))}
    </div>
  )
}
