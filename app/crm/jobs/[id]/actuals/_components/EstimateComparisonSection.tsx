import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { JobActualsSnapshotVm } from '../_lib/jobActualsVm'

type EstimateComparisonSectionProps = {
  vm: JobActualsSnapshotVm
}

export function EstimateComparisonSection({ vm }: EstimateComparisonSectionProps) {
  return (
    <CrmSectionCard title="Estimate comparison" variant="rail">
      <div className="grid gap-3">
        {vm.hasInvalidActuals ? (
          <div className="rounded-xl border border-[color:var(--crm-ui-warning-border)] bg-[color:var(--crm-ui-warning-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--crm-ui-warning-text)]">
            Comparison preview is paused for invalid actuals.
          </div>
        ) : null}

        <div className="ace-crm-surface-muted p-3">
          <div className="text-sm font-black text-[color:var(--crm-ui-text)]">
            {vm.versionName}
          </div>
          <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
            Accepted {vm.acceptedAt}
          </div>
          <div className="mt-2 text-sm font-extrabold text-[color:var(--crm-ui-text)]">
            Quote total {vm.finalTotal}
          </div>
        </div>

        <div className="grid gap-2">
          {vm.rows.map((row) => (
            <div
              key={row.id}
              className={`ace-crm-surface p-3 ${
                row.error ? 'border-[color:var(--crm-ui-warning-border)]' : ''
              }`}
            >
              <div className="text-sm font-black text-[color:var(--crm-ui-text)]">
                {row.label}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                    Estimate
                  </dt>
                  <dd className="font-bold text-[color:var(--crm-ui-text)]">
                    {row.estimate}
                  </dd>
                </div>
                <div>
                  <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                    Actual
                  </dt>
                  <dd
                    className={`font-bold ${
                      row.error
                        ? 'text-[color:var(--crm-ui-warning-text)]'
                        : 'text-[color:var(--crm-ui-text)]'
                    }`}
                  >
                    {row.actual}
                  </dd>
                </div>
                <div>
                  <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                    Delta
                  </dt>
                  <dd
                    className={`font-bold ${
                      row.error
                        ? 'text-[color:var(--crm-ui-warning-text)]'
                        : 'text-[color:var(--crm-ui-text)]'
                    }`}
                  >
                    {row.variance}
                  </dd>
                </div>
              </dl>
              {row.error ? (
                <div className="mt-2 text-xs font-semibold text-[color:var(--crm-ui-warning-text)]">
                  {row.error}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </CrmSectionCard>
  )
}
