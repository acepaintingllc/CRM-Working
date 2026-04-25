import type { DetailsOverrideVm } from '../_lib/estimateV2DetailsVm'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'

export function EstimateV2DetailsActiveOverrides({
  activeOverrides,
}: {
  activeOverrides: DetailsOverrideVm[]
}) {
  if (activeOverrides.length === 0) {
    return <div className="text-sm text-[color:var(--crm-ui-muted)]">No active gallon overrides.</div>
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {activeOverrides.map((override) => (
        <div key={override.key} className="ace-crm-surface-muted rounded-xl px-4 py-3">
          <div className="font-black">{override.itemName}</div>
          <div className="mt-1 text-sm text-[color:var(--crm-ui-accent)]">
            {formatDetailsNumber(override.originalValue)} to {formatDetailsNumber(override.newValue)} gal
          </div>
        </div>
      ))}
    </div>
  )
}
