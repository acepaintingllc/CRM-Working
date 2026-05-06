import { allMajorPolicyFlagsFixture } from './allMajorPolicyFlags.ts'
import { allScopeTypesFixture } from './allScopeTypes.ts'
import { manualOverridesDisabledScopesFixture } from './manualOverridesDisabledScopes.ts'
import { multiRoomGeometryVariationFixture } from './multiRoomGeometryVariation.ts'
import { simpleNoOverridesFixture } from './simpleNoOverrides.ts'

export type {
  EstimateV2CanonicalExpectedTotals,
  EstimateV2CanonicalFixture,
  EstimateV2CanonicalRoomTotal,
  EstimateV2CanonicalScopeTotal,
} from '../estimateV2CanonicalFixtureTypes.ts'

export {
  allMajorPolicyFlagsFixture,
  allScopeTypesFixture,
  manualOverridesDisabledScopesFixture,
  multiRoomGeometryVariationFixture,
  simpleNoOverridesFixture,
}

export const CANONICAL_FIXTURES = [
  simpleNoOverridesFixture,
  allScopeTypesFixture,
  allMajorPolicyFlagsFixture,
  manualOverridesDisabledScopesFixture,
  multiRoomGeometryVariationFixture,
] as const
