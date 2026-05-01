import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2MaterialPlanningVm,
  buildEstimateV2RollerPlanningVm,
  buildEstimateV2TotalsVm,
  buildEstimateV2ValidationVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  extractEstimateV2DetailsCalculationRows,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
} from '../estimateV2DetailsVm'
import {
  createWallRows,
} from '../estimateV2DetailsMaterials'
import {
  applyGroupedMaterialOverridePersistencePolicy,
  resolveGroupedOverride,
} from '../estimateV2DetailsMaterialOverrides'
import { calculationRowsById } from '../estimateV2DetailsMaterialCalculations'
import { resolveRollerRowState, validateRollerRow } from '../estimateV2DetailsRollers'
import { formatDetailsNumber } from '../estimateV2DetailsShared'
import {
  createMaterialCards,
  createValidationIssues,
  createValidationSummary,
  getBlockingValidationIssues,
} from '../estimateV2DetailsValidation'
import {
  buildVm,
  buildVmParams,
  ceilingCalculationRow,
  ceilingScope,
  rooms,
  testIssue,
  trimCalculationRow,
  trimScope,
  validationIds,
  validationMessages,
  wallCalculationRow,
  wallScope,
} from './estimateV2DetailsVm.testUtils'
import type {
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

type DetailsVm = ReturnType<typeof buildVm>

describe('estimate details VM conditions', () => {

  describe('conditions VM', () => {
    const wallModifier = {
      id: 'WALL_OIL',
      displayName: 'Oil-based paint',
      scope: 'wall' as const,
      modifierType: 'binary' as const,
      factorField: 'wall_factor',
      levels: { active: 1.2 },
    }
    const roomModifier = {
      id: 'ROOM_FURNISHED',
      displayName: 'Furnished room',
      scope: 'room' as const,
      modifierType: 'binary' as const,
      factorField: '',
      levels: { active: 1.15 },
    }

    it('reports available=false and zero active counts when no modifiers are configured', () => {
      const vm = buildVm()
      expect(vm.conditions.available).toBe(false)
      expect(vm.conditions.conditions).toHaveLength(0)
      expect(vm.conditions.wallActiveCount).toBe(0)
      expect(vm.conditions.roomActiveCount).toBe(0)
    })

    it('reports available=true when modifiers are present', () => {
      const vm = buildVm({ conditionModifiers: [wallModifier] })
      expect(vm.conditions.available).toBe(true)
      expect(vm.conditions.conditions).toHaveLength(1)
    })

    it('counts active wall selections correctly', () => {
      const vm = buildVm({
        conditionModifiers: [wallModifier, roomModifier],
        conditionSelections: {
          room: {},
          wall: { WALL_OIL: 'active' },
          ceiling: {},
          trim: {},
        },
      })
      expect(vm.conditions.wallActiveCount).toBe(1)
      expect(vm.conditions.roomActiveCount).toBe(0)
    })

    it('counts active room selections independently from wall selections', () => {
      const vm = buildVm({
        conditionModifiers: [wallModifier, roomModifier],
        conditionSelections: {
          room: { ROOM_FURNISHED: 'active' },
          wall: { WALL_OIL: 'active' },
          ceiling: {},
          trim: {},
        },
      })
      expect(vm.conditions.roomActiveCount).toBe(1)
      expect(vm.conditions.wallActiveCount).toBe(1)
    })

    it('resolves scope factors from active selections', () => {
      const vm = buildVm({
        conditionModifiers: [wallModifier, roomModifier],
        conditionSelections: {
          room: { ROOM_FURNISHED: 'active' },
          wall: { WALL_OIL: 'active' },
          ceiling: {},
          trim: {},
        },
      })
      expect(vm.conditions.scopeFactors.wall).toBe(1.2)
      expect(vm.conditions.scopeFactors.room).toBe(1.15)
      expect(vm.conditions.scopeFactors.ceiling).toBe(1)
      expect(vm.conditions.scopeFactors.trim).toBe(1)
    })

    it('emits template-unavailable warning when saved selections exist but no modifiers configured', () => {
      const materialPlanning = buildEstimateV2MaterialPlanningVm(buildVmParams())
      const vm = buildEstimateV2ValidationVm({
        materialPlanning,
        rollerPlanning: buildEstimateV2RollerPlanningVm({
          materialPlanning,
          rollerOptions: [],
          rollers: [],
        }),
        conditionsVm: {
          available: false,
          conditions: [],
          selections: { room: {}, wall: { WALL_OIL: 'active' }, ceiling: {}, trim: {} },
          roomActiveCount: 0,
          wallActiveCount: 1,
          ceilingActiveCount: 0,
          trimActiveCount: 0,
          scopeFactors: { room: 1, wall: 1, ceiling: 1, trim: 1 },
        },
      })
      expect(validationIds(vm as DetailsVm)).toContain('conditions:template-unavailable')
      const issue = vm.validationIssues.find((i) => i.id === 'conditions:template-unavailable')
      expect(issue?.severity).toBe('warning')
    })

    it('does not emit template-unavailable warning when no selections exist', () => {
      const materialPlanning = buildEstimateV2MaterialPlanningVm(buildVmParams())
      const vm = buildEstimateV2ValidationVm({
        materialPlanning,
        rollerPlanning: buildEstimateV2RollerPlanningVm({
          materialPlanning,
          rollerOptions: [],
          rollers: [],
        }),
        conditionsVm: {
          available: false,
          conditions: [],
          selections: { room: {}, wall: {}, ceiling: {}, trim: {} },
          roomActiveCount: 0,
          wallActiveCount: 0,
          ceilingActiveCount: 0,
          trimActiveCount: 0,
          scopeFactors: { room: 1, wall: 1, ceiling: 1, trim: 1 },
        },
      })
      expect(validationIds(vm as DetailsVm)).not.toContain('conditions:template-unavailable')
    })
  })
})
