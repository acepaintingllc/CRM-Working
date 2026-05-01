import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'
import type { EstimateV2DetailsVm } from '../_lib/estimateV2DetailsVm'

export function EstimateV2DetailsSummaryRail({
  vm,
}: {
  vm: EstimateV2DetailsVm
}) {
  return (
    <aside className="order-first grid gap-4 md:grid-cols-2 xl:order-none xl:sticky xl:top-4 xl:grid-cols-1">
      <CrmSectionCard
        title="Validation"
        description={vm.validationSummary.message}
        badge={
          <CrmChip tone={vm.canContinueToSummary ? 'success' : 'danger'}>
            {vm.validationSummary.title}
          </CrmChip>
        }
        variant="rail"
        className="md:col-span-2 xl:col-span-1"
      >
        <div className="grid gap-3">
          {vm.validationIssues.length === 0 ? (
            <CrmNotice tone="success" compact>
              {vm.validationSummary.message}
            </CrmNotice>
          ) : (
            <CrmNotice tone="warning" title="Required before summary" compact>
              <ul className="list-disc space-y-1 pl-4">
                {vm.validationIssues.map((issue) => (
                  <li key={issue.id}>{issue.message}</li>
                ))}
              </ul>
            </CrmNotice>
          )}
          {vm.continueBlockedReason ? (
            <div className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">
              {vm.continueBlockedReason}
            </div>
          ) : null}
        </div>
      </CrmSectionCard>

      <CrmSectionCard title="Active Overrides" variant="rail">
        {vm.activeOverrides.length === 0 ? (
          <div className="text-sm text-[color:var(--crm-ui-muted)]">None</div>
        ) : (
          <div className="grid gap-2 text-sm">
            {vm.activeOverrides.map((override) => (
              <div key={override.key} className="flex justify-between gap-3">
                <span>{override.itemName}</span>
                <strong className="text-[color:var(--crm-ui-accent)]">
                  {formatDetailsNumber(override.newValue)} gal
                </strong>
              </div>
            ))}
          </div>
        )}
      </CrmSectionCard>

      <CrmSectionCard title="Gallons By Scope" variant="rail">
        {[
          ['Walls', vm.gallonsByScope.walls],
          ['Ceilings', vm.gallonsByScope.ceilings],
          ['Trim', vm.gallonsByScope.trim],
          ['Total', vm.gallonsByScope.total],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b border-[color:var(--crm-ui-border)] py-2 text-sm last:border-b-0"
          >
            <span>{label}</span>
            <strong>{formatDetailsNumber(Number(value))}</strong>
          </div>
        ))}
      </CrmSectionCard>
    </aside>
  )
}
