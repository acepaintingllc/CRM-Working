'use client'

import { ArrowLeft, Save } from 'lucide-react'
import type { ReactNode } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { CrmConfirmDialog } from '@/app/crm/_components/CrmConfirmDialog'
import {
  estimateRouteFamily,
  quoteRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import { EstimateV2WorkflowFooterBar } from '../../_components/EstimateV2WorkflowFooterBar'
import { EstimateV2DetailsActiveOverrides } from './EstimateV2DetailsActiveOverrides'
import { EstimateV2DetailsMaterialOverview } from './EstimateV2DetailsMaterialOverview'
import { EstimateV2DetailsMaterialTable } from './EstimateV2DetailsMaterialTable'
import { EstimateV2DetailsRollerRows } from './EstimateV2DetailsRollerRows'
import { EstimateV2DetailsSummaryRail } from './EstimateV2DetailsSummaryRail'
import { EstimateV2DetailsRoomConditions } from './EstimateV2DetailsRoomConditions'
import { useEstimateV2DetailsPage } from '../_state/useEstimateV2DetailsPage'
import { DETAILS_UNSAVED_CHANGES_MESSAGE } from '../_state/useEstimateV2DetailsController'
import { formatDetailsNumber } from '../_lib/estimateV2DetailsShared'

const labelClassName =
  'ace-crm-mono text-[11px] font-black uppercase text-[color:var(--crm-ui-muted-2)]'

function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </span>
  )
}

function rollerPlanningRowCount(vm: { wallRollerRows: unknown[]; ceilingRollerRow: unknown | null }) {
  return vm.wallRollerRows.length + (vm.ceilingRollerRow ? 1 : 0)
}

export function EstimateV2DetailsPageContent({
  estimateId,
  routeFamilyKey = 'estimate',
  routeFamily,
}: {
  estimateId: string
  routeFamilyKey?: 'estimate' | 'quote'
  routeFamily?: EstimateRouteFamily
}) {
  const resolvedRouteFamily =
    routeFamily ?? (routeFamilyKey === 'quote' ? quoteRouteFamily : estimateRouteFamily)
  const page = useEstimateV2DetailsPage({ estimateId, routeFamily: resolvedRouteFamily })
  const { vm, actions } = page
  const saveError = page.error && page.estimate ? page.error.message : null
  const rollerRowCount = rollerPlanningRowCount(vm)

  if (page.loading) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Loading details">
          <div role="status" aria-label="Loading estimate details" className="text-sm text-[color:var(--crm-ui-muted)]">
            Loading details...
          </div>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  if (page.error && !page.estimate) {
    return (
      <CrmPageShell>
        <CrmSectionCard title="Details unavailable">
          <CrmNotice tone="error">{page.error.message}</CrmNotice>
        </CrmSectionCard>
      </CrmPageShell>
    )
  }

  return (
    <CrmPageShell className="max-w-[1480px]">
      <CrmPageHeader
        title="Details & Overrides"
        description="Material planning, gallon overrides, persisted wall and ceiling roller planning, and final validation before summary."
        eyebrow="Estimate V2"
        backAction={
          <CrmButton type="button" tone="secondary" onClick={() => void actions.returnToEditor()}>
            <IconLabel icon={<ArrowLeft size={16} aria-hidden="true" />}>Back</IconLabel>
          </CrmButton>
        }
        actions={
          <>
            <CrmChip tone={page.dirty ? 'warning' : 'success'}>{page.saveStatusText}</CrmChip>
            <CrmButton type="button" onClick={() => void actions.saveDraft()} disabled={page.saving}>
              <IconLabel icon={<Save size={16} aria-hidden="true" />}>
                {page.saving ? 'Saving...' : 'Save Draft'}
              </IconLabel>
            </CrmButton>
          </>
        }
        meta={
          <>
            <CrmChip tone="accent">{page.estimate?.version_name ?? 'Estimate'}</CrmChip>
            <CrmChip>Crew: {vm.crewSize}</CrmChip>
            <CrmChip tone={vm.canContinueToSummary ? 'success' : 'danger'}>
              {vm.validationSummary.title}
            </CrmChip>
          </>
        }
      />

      {saveError ? <CrmNotice tone="error" title="Save failed">{saveError}</CrmNotice> : null}
      {!vm.canContinueToSummary ? (
        <CrmNotice tone="warning" title="Summary blocked">
          {vm.validationSummary.message}
        </CrmNotice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="grid min-w-0 gap-4">
          <CrmSectionCard
            title="Crew Size"
            description="Multiplies per-person supply items (brushes, trays) automatically"
          >
            <label className="grid max-w-[220px] gap-2">
              <span className={labelClassName}>Crew Size</span>
              <input
                type="number"
                min={1}
                step={1}
                value={vm.crewSize}
                onChange={(event) => actions.setCrewSize(event.currentTarget.valueAsNumber)}
                className="h-10 rounded-[6px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] px-3 text-sm font-semibold text-[color:var(--crm-ui-ink)] outline-none focus:border-[color:var(--crm-ui-accent)]"
              />
            </label>
          </CrmSectionCard>

          <CrmSectionCard
            title="Rollers"
            description={`${rollerRowCount} required persisted planning row${rollerRowCount === 1 ? '' : 's'}.`}
          >
            <div className="grid gap-5">
              {vm.rollerOptionsState.status !== 'loaded' ? (
                <CrmNotice
                  tone={vm.rollerOptionsState.status === 'unavailable' ? 'error' : 'warning'}
                  compact
                >
                  {vm.rollerOptionsState.message}
                </CrmNotice>
              ) : null}
              <div className="grid gap-2">
                <div className={labelClassName}>Wall Rollers</div>
                <EstimateV2DetailsRollerRows
                  rows={vm.wallRollerRows}
                  options={vm.wallRollerOptions}
                  onChange={actions.setRollerRow}
                />
              </div>
              {vm.ceilingRollerRow ? (
                <div className="grid gap-2">
                  <div className={labelClassName}>Ceiling Rollers</div>
                  <EstimateV2DetailsRollerRows
                    rows={[vm.ceilingRollerRow]}
                    options={vm.ceilingRollerOptions}
                    onChange={actions.setRollerRow}
                  />
                </div>
              ) : null}
              {vm.trimApplicatorSummary?.active ? (
                <CrmChip>
                  Trim: 1 brush + 1 roller per color included automatically via supply rates
                </CrmChip>
              ) : null}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Material Overview" description="Final gallons use saved overrides when present.">
            <EstimateV2DetailsMaterialOverview materialCards={vm.materialCards} />
          </CrmSectionCard>

          {vm.conditions.conditions.some((c) => c.scope === 'room') ? (
            <CrmSectionCard title="Room Conditions" description="Conditions that apply a factor across all scopes in every room.">
              <EstimateV2DetailsRoomConditions
                conditions={vm.conditions.conditions}
                selections={vm.conditions.selections}
                onToggle={(id, level) => actions.setRoomCondition('room', id, level)}
              />
            </CrmSectionCard>
          ) : null}

          {vm.wallRows.length > 0 ? (
            <CrmSectionCard title="Paint Planning" description={vm.materialPlanningSections.walls.description}>
              <EstimateV2DetailsMaterialTable
                rows={vm.wallRows}
                onOverride={(row, value) => actions.setWallOverride(row.colorId ?? row.id, value)}
                emptyTitle={vm.materialPlanningSections.walls.emptyTitle}
                emptyMessage={vm.materialPlanningSections.walls.emptyMessage}
                scope="wall"
                conditionsVm={vm.conditions}
                onConditionToggle={(id, level) => actions.setRoomCondition('wall', id, level)}
              />
            </CrmSectionCard>
          ) : null}

          {vm.ceilingRow ? (
            <CrmSectionCard title="Ceiling Paint Planning" description={vm.materialPlanningSections.ceilings.description}>
              <EstimateV2DetailsMaterialTable
                rows={[vm.ceilingRow]}
                onOverride={(_, value) => actions.setCeilingOverride(value)}
                emptyTitle={vm.materialPlanningSections.ceilings.emptyTitle}
                emptyMessage={vm.materialPlanningSections.ceilings.emptyMessage}
                scope="ceiling"
                conditionsVm={vm.conditions}
                onConditionToggle={(id, level) => actions.setRoomCondition('ceiling', id, level)}
              />
            </CrmSectionCard>
          ) : null}

          {vm.trimRow ? (
            <CrmSectionCard title="Trim Paint Planning" description={vm.materialPlanningSections.trim.description}>
              <EstimateV2DetailsMaterialTable
                rows={[vm.trimRow]}
                onOverride={(_, value) => actions.setTrimOverride(value)}
                emptyTitle={vm.materialPlanningSections.trim.emptyTitle}
                emptyMessage={vm.materialPlanningSections.trim.emptyMessage}
                scope="trim"
                conditionsVm={vm.conditions}
                onConditionToggle={(id, level) => actions.setRoomCondition('trim', id, level)}
              />
            </CrmSectionCard>
          ) : null}

          <CrmSectionCard title="Active Overrides" description="Saved gallon overrides that will affect material totals.">
            <EstimateV2DetailsActiveOverrides activeOverrides={vm.activeOverrides} />
          </CrmSectionCard>
        </main>

        <EstimateV2DetailsSummaryRail vm={vm} />
      </div>
      <EstimateV2WorkflowFooterBar
        label="Material planning total"
        value={`${formatDetailsNumber(vm.gallonsByScope.total)} gal`}
        metrics={[
          { label: 'Material est.', value: `$${Math.round(vm.estimatedMaterialCost).toLocaleString('en-US')}` },
          { label: 'Overrides', value: vm.activeOverrides.length },
          { label: 'Validation', value: vm.validationSummary.title },
        ]}
        status={`Status: ${page.saveStatusText}`}
        backAction={{
          type: 'button',
          label: '<- Back',
          onClick: () => void actions.returnToEditor(),
          disabled: page.saving,
        }}
        secondaryAction={{
          label: page.saving ? 'Saving...' : 'Save details',
          onClick: () => void actions.saveDraft(),
          disabled: page.saving || !page.dirty,
        }}
        primaryAction={{
          type: 'button',
          label: page.saving ? 'Saving...' : 'Continue to summary ->',
          onClick: () => void actions.continueToSummary(),
          disabled: page.saving || !vm.canContinueToSummary,
          title: vm.continueBlockedReason ?? undefined,
        }}
      />
      <CrmConfirmDialog
        isOpen={page.discardVm.isOpen}
        labelledBy="estimate-details-discard-title"
        title="Discard unsaved changes?"
        description="You have unsaved details edits that are not yet saved."
        closeLabel="Close discard confirmation"
        warning={DETAILS_UNSAVED_CHANGES_MESSAGE}
        info="Choose Discard to return to the editor, or Cancel to keep editing details."
        confirmLabel="Discard and return"
        onConfirm={() => void actions.confirmReturnToEditor()}
        onCancel={actions.cancelDiscard}
      />
    </CrmPageShell>
  )
}
