'use client'

import type { ConditionLevel, EstimateV2ConditionModifier, EstimateV2ConditionSelections } from '@/types/estimator/v2'

export function EstimateV2DetailsRoomConditions({
  conditions,
  selections,
  onToggle,
}: {
  conditions: EstimateV2ConditionModifier[]
  selections: EstimateV2ConditionSelections
  onToggle: (conditionId: string, level: ConditionLevel | null) => void
}) {
  const roomConditions = conditions.filter((c) => c.scope === 'room')
  if (roomConditions.length === 0) return null

  return (
    <div className="mb-4 rounded-[6px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] px-4 py-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[color:var(--crm-ui-muted-2)] ace-crm-mono">
        Room Conditions
      </p>
      <div className="flex flex-wrap gap-4">
        {roomConditions.map((condition) => {
          const isActive = condition.id in selections.room
          return (
            <label key={condition.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggle(condition.id, isActive ? null : 'active')}
                className="h-4 w-4 rounded border-[color:var(--crm-ui-border)]"
              />
              <span>{condition.displayName}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
