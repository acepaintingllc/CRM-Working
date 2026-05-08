'use client'

import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { JobCloseoutReferenceVm } from '@/app/crm/jobs/[id]/_lib/jobCloseoutVm'

type JobCloseoutPanelProps = {
  vm: JobCloseoutReferenceVm | null
}

export default function JobCloseoutPanel({ vm }: JobCloseoutPanelProps) {
  if (!vm) return null

  return (
    <CrmSectionCard title="Closeout Reference" variant="compact">
      <div className="grid gap-4 text-sm">
        <div>
          <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
            Closeout notes
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[color:var(--crm-ui-text)]">
            {vm.notes}
          </div>
        </div>
        <div>
          <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
            Paint logs
          </div>
          {vm.paintLogs.length === 0 ? (
            <CrmEmptyState
              compact
              title="No paint logs"
              description="No paint logs saved yet."
              className="mt-2"
            />
          ) : (
            <div className="mt-2 grid gap-2">
              {vm.paintLogs.map((row) => (
                <div key={row.key} className="ace-crm-surface-muted rounded-[14px] px-3 py-3">
                  <div className="font-semibold text-[color:var(--crm-ui-text)]">{row.area}</div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--crm-ui-muted)]">
                    Product: {row.product} | Sheen: {row.sheen} | Color: {row.color}
                  </div>
                  {row.notes ? (
                    <div className="mt-1 text-xs leading-5 text-[color:var(--crm-ui-muted)]">
                      {row.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CrmSectionCard>
  )
}
