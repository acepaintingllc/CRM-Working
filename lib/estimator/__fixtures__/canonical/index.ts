import { allMajorPolicyFlagsFixture } from './allMajorPolicyFlags.ts'
import { allScopeTypesFixture } from './allScopeTypes.ts'
import { exteriorTrimFixture } from './exteriorTrim.ts'
import { estimateV2FunctionalCompletenessSmokeFixture } from './estimateV2FunctionalCompletenessSmoke.ts'
import { fullMasterBedroomFixture } from './fullMasterBedroom.ts'
import { manualOverridesDisabledScopesFixture } from './manualOverridesDisabledScopes.ts'
import { multiRoomGeometryVariationFixture } from './multiRoomGeometryVariation.ts'
import { simpleNoOverridesFixture } from './simpleNoOverrides.ts'
import { simpleHallwayRepaintFixture } from './simpleHallwayRepaint.ts'

export type {
  EstimateV2CanonicalExpectedTotals,
  EstimateV2CanonicalExpectedMismatch,
  EstimateV2CanonicalFixture,
  EstimateV2CanonicalFixtureMetadata,
  EstimateV2HistoricalScenarioAdapter,
  EstimateV2HistoricalScenarioSourceType,
  EstimateV2CanonicalRoomTotal,
  EstimateV2CanonicalScopeFamily,
  EstimateV2CanonicalScopeTotal,
  EstimateV2HistoricalMismatchCategory,
} from '../estimateV2CanonicalFixtureTypes.ts'

export {
  allMajorPolicyFlagsFixture,
  allScopeTypesFixture,
  exteriorTrimFixture,
  estimateV2FunctionalCompletenessSmokeFixture,
  fullMasterBedroomFixture,
  manualOverridesDisabledScopesFixture,
  multiRoomGeometryVariationFixture,
  simpleNoOverridesFixture,
  simpleHallwayRepaintFixture,
}

export { estimateV2FunctionalCompletenessSmokeIds } from './estimateV2FunctionalCompletenessSmoke.ts'

export const CANONICAL_FIXTURES = [
  simpleNoOverridesFixture,
  allScopeTypesFixture,
  allMajorPolicyFlagsFixture,
  manualOverridesDisabledScopesFixture,
  multiRoomGeometryVariationFixture,
  simpleHallwayRepaintFixture,
  fullMasterBedroomFixture,
  exteriorTrimFixture,
] as const
