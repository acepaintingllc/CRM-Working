'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import { S } from './quoteHomeStyles'
import type { QuotesHomeSelectedJobVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeSelectedJobVm
}

export function QuotesHomeSelectedJobPanel({ vm }: Props) {
  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Selected Job"
      actions={
        vm.jobHref ? (
          <CrmButton href={vm.jobHref} prefetch={false}>
            Open job
          </CrmButton>
        ) : null
      }
    >
      <QuotesHomeSelectedJobContent vm={vm} />
    </CrmSectionCard>
  )
}

export function QuotesHomeSelectedJobResponsivePanel({ vm }: Props) {
  const isMobile = useMediaQuery('(max-width: 900px)')

  if (isMobile) {
    return <QuotesHomeSelectedJobMobileDisclosure vm={vm} />
  }

  return <QuotesHomeSelectedJobPanel vm={vm} />
}

function QuotesHomeSelectedJobMobileDisclosure({ vm }: Props) {
  const [open, setOpen] = useState(false)
  const state = vm.state ?? (vm.title ? 'selected' : vm.loading ? 'loading' : 'empty')
  const title = vm.title ?? 'Selected job'
  const triggerDetail =
    state === 'selected'
      ? vm.customerLine
      : state === 'loading'
        ? 'Loading job details...'
        : vm.emptyMessage

  return (
    <>
      <div
        className="rounded-lg border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] px-3 py-3"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="ace-crm-mono text-[10px] font-bold text-[color:var(--crm-ui-muted)]">
              Selected Job
            </div>
            <div className="mt-1 truncate text-sm font-black text-[color:var(--crm-ui-text)]">
              {title}
            </div>
            {triggerDetail ? (
              <div className="mt-0.5 truncate text-xs text-[color:var(--crm-ui-muted)]">
                {triggerDetail}
              </div>
            ) : null}
          </div>
          <CrmButton
            onClick={() => setOpen(true)}
            disabled={state === 'empty' && !vm.emptyMessage}
            aria-label="View selected job info"
          >
            <Info size={16} aria-hidden="true" />
            Info
          </CrmButton>
        </div>
      </div>

      {open ? (
        <CrmModalShell
          labelledBy="quote-home-selected-job-modal-title"
          onClose={() => setOpen(false)}
          widthClassName="max-w-lg"
        >
          <CrmModalHeader
            labelledBy="quote-home-selected-job-modal-title"
            eyebrow="Selected Job"
            title={title}
            description={vm.customerLine ?? undefined}
            onClose={() => setOpen(false)}
            closeLabel="Close selected job info"
          />
          <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
            <div className="grid gap-4">
              <QuotesHomeSelectedJobContent vm={vm} />
              {vm.jobHref ? (
                <div>
                  <CrmButton href={vm.jobHref} prefetch={false}>
                    Open job
                  </CrmButton>
                </div>
              ) : null}
            </div>
          </div>
        </CrmModalShell>
      ) : null}
    </>
  )
}

function QuotesHomeSelectedJobContent({ vm }: Props) {
  const state = vm.state ?? (vm.title ? 'selected' : vm.loading ? 'loading' : 'empty')

  return (
    <div aria-live="polite" aria-busy={state === 'loading' || undefined}>
      {state === 'empty' && vm.emptyMessage ? (
        <div style={S.mutedText}>{vm.emptyMessage}</div>
      ) : null}

      {state === 'selected' && vm.title ? (
        <div style={S.grid18}>
          <div style={S.grid12}>
            <div>
              <div style={S.selectedJobTitle}>{vm.title}</div>
              {vm.customerLine ? (
                <div style={S.bodyTextStrong}>{vm.customerLine}</div>
              ) : null}
            </div>
          </div>

          <div
            className="quotes-home-selected-job-stats"
            style={S.selectedJobStatsGrid}
          >
            {vm.stats.map((stat) => (
              <div key={stat.label} style={S.selectedJobStatCard}>
                <div style={S.selectedJobStatLabel}>{stat.label}</div>
                <div style={S.selectedJobStatValue}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
