import { buildEstimateV2SavePayload } from '../v2DraftPayload.ts'
import {
  toCeilingCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
  toTrimCalculationCatalogs,
  toWallCalculationCatalogs,
} from '../../server/estimateV2RoutePayload.ts'
import {
  calculateEstimateV2ArtifactsFromPayload,
  type EstimateV2CalculationCatalogBundle,
} from '../../server/estimate-v2/calculationOrchestration.ts'
import type {
  EstimateV2CanonicalExpectedMismatch,
  EstimateV2CanonicalFixture,
  EstimateV2CanonicalScopeFamily,
  EstimateV2HistoricalScenarioAdapter,
} from '../__fixtures__/canonical/index.ts'
import type { EstimateV2Catalogs } from '@/types/estimator/v2Catalogs'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

type EstimateV2HistoricalComparisonTarget =
  | { metric: 'final_total' }
  | { metric: 'room_total'; roomId: string }
  | { metric: 'scope_total'; family: EstimateV2CanonicalScopeFamily; scopeId: string; roomId?: string }

export type EstimateV2HistoricalComparisonMismatch = {
  target: EstimateV2HistoricalComparisonTarget
  category: EstimateV2CanonicalExpectedMismatch['category']
  expected: number | 'missing'
  actual: number | 'missing'
  note: string | null
}

export type EstimateV2HistoricalComparisonResult = {
  fixture: EstimateV2CanonicalFixture
  mismatches: EstimateV2HistoricalComparisonMismatch[]
  expectedMismatchAnnotations: EstimateV2CanonicalExpectedMismatch[]
  matchedExpectedMismatchAnnotations: EstimateV2CanonicalExpectedMismatch[]
  unmatchedExpectedMismatchAnnotations: EstimateV2CanonicalExpectedMismatch[]
}

export type EstimateV2HistoricalComparisonScenarioInput =
  | EstimateV2CanonicalFixture
  | EstimateV2HistoricalScenarioAdapter

type ScopeTotalsByFamily = Record<EstimateV2CanonicalScopeFamily, Map<string, { roomId: string; total: number | null }>>

function toServerCatalogBundle(catalogs: EstimateV2Catalogs): EstimateV2CalculationCatalogBundle {
  const source = catalogs as unknown as Record<string, unknown>
  return {
    source,
    wall: toWallCalculationCatalogs(source),
    ceiling: toCeilingCalculationCatalogs(source),
    trim: toTrimCalculationCatalogs(source),
    door: toDoorCalculationCatalogs(source),
    drywall: toDrywallCalculationCatalogs(source),
  }
}

export function resolveEstimateV2HistoricalComparisonFixture(
  input: EstimateV2HistoricalComparisonScenarioInput
): EstimateV2CanonicalFixture {
  if ('toCanonicalFixture' in input) {
    // Full DB-backed historical import is intentionally deferred. This small adapter seam
    // marks where a future imported scenario can be normalized into today's canonical shape.
    return input.toCanonicalFixture()
  }
  return input
}

export function buildEstimateV2CanonicalComparisonPayload(
  fixtureInput: EstimateV2HistoricalComparisonScenarioInput
): EstimateV2SavePayload {
  const fixture = resolveEstimateV2HistoricalComparisonFixture(fixtureInput)
  const { collections, meta } = fixture.editorState
  return buildEstimateV2SavePayload(
    meta.jobSettingsDraft,
    collections.rooms,
    collections.scopes,
    collections.segments,
    collections.roomFlags,
    collections.ceilingScopes,
    collections.ceilingSegments,
    collections.trimScopes,
    collections.rollers,
    collections.doorScopes,
    collections.drywallRepairs,
    collections.accessFees,
    collections.otherItems
  )
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function calculateArtifacts(fixture: EstimateV2CanonicalFixture) {
  const payload = buildEstimateV2CanonicalComparisonPayload(fixture)
  return calculateEstimateV2ArtifactsFromPayload({
    payload,
    calculationCatalogs: toServerCatalogBundle(fixture.editorState.meta.catalogs),
    orgDefaults: null,
  })
}

function scopeTotalsFromArtifacts(
  artifacts: ReturnType<typeof calculateArtifacts>
): ScopeTotalsByFamily {
  return {
    walls: new Map(
      artifacts.wallCalculations.scopes.map((row) => [
        String(row.id),
        { roomId: String(row.room_id ?? ''), total: asFiniteNumber(row.effective_total) },
      ] as const)
    ),
    ceilings: new Map(
      artifacts.ceilingCalculations.scopes.map((row) => [
        String(row.id),
        { roomId: String(row.room_id ?? ''), total: asFiniteNumber(row.effective_total) },
      ] as const)
    ),
    trim: new Map(
      artifacts.trimCalculations.scopes.map((row) => [
        String(row.id),
        { roomId: String(row.room_id ?? ''), total: asFiniteNumber(row.effective_total) },
      ] as const)
    ),
    doors: new Map(
      artifacts.doorCalculations.scopes.map((row) => [
        String(row.id),
        { roomId: String(row.room_id ?? ''), total: asFiniteNumber(row.effective_total) },
      ] as const)
    ),
    drywall: new Map(
      artifacts.drywallCalculations.scopes.map((row) => [
        String(row.id),
        { roomId: String(row.room_id ?? ''), total: asFiniteNumber(row.effective_total) },
      ] as const)
    ),
    accessFees: new Map(
      artifacts.accessFeeCalculation.rows.map((row) => [
        row.id,
        { roomId: row.roomId ?? '', total: row.total },
      ] as const)
    ),
  }
}

function numbersMatch(expected: number | 'missing', actual: number | 'missing') {
  if (expected === 'missing' || actual === 'missing') return expected === actual
  return Math.abs(expected - actual) < 0.005
}

function mismatchSortKey(mismatch: EstimateV2HistoricalComparisonMismatch) {
  if (mismatch.target.metric === 'final_total') return '0:final_total'
  if (mismatch.target.metric === 'room_total') return `1:room_total:${mismatch.target.roomId}`
  return `2:scope_total:${mismatch.target.family}:${mismatch.target.scopeId}`
}

function annotationMatchesTarget(
  annotation: EstimateV2CanonicalExpectedMismatch,
  target: EstimateV2HistoricalComparisonTarget
) {
  if (annotation.metric !== target.metric) return false
  if (target.metric === 'final_total') return true
  if (target.metric === 'room_total') return annotation.roomId === target.roomId
  return annotation.family === target.family && annotation.scopeId === target.scopeId
}

function compareValue(params: {
  mismatches: EstimateV2HistoricalComparisonMismatch[]
  matchedAnnotations: EstimateV2CanonicalExpectedMismatch[]
  expectedAnnotations: EstimateV2CanonicalExpectedMismatch[]
  target: EstimateV2HistoricalComparisonTarget
  expected: number | 'missing'
  actual: number | 'missing'
}) {
  if (numbersMatch(params.expected, params.actual)) return
  const annotation = params.expectedAnnotations.find((item) => annotationMatchesTarget(item, params.target))
  if (annotation) params.matchedAnnotations.push(annotation)
  params.mismatches.push({
    target: params.target,
    category: annotation?.category ?? 'actual_defect',
    expected: params.expected,
    actual: params.actual,
    note: annotation?.note ?? null,
  })
}

export function runEstimateV2HistoricalComparison(
  fixtureInput: EstimateV2HistoricalComparisonScenarioInput
): EstimateV2HistoricalComparisonResult {
  const fixture = resolveEstimateV2HistoricalComparisonFixture(fixtureInput)
  const artifacts = calculateArtifacts(fixture)
  const roomTotals = new Map<string, number>(
    artifacts.pricingSummary.rooms.map((room) => [room.room_id, room.finalTotal] as const)
  )
  const scopeTotals = scopeTotalsFromArtifacts(artifacts)
  const expectedAnnotations = fixture.expectedMismatches ?? []
  const matchedAnnotations: EstimateV2CanonicalExpectedMismatch[] = []
  const mismatches: EstimateV2HistoricalComparisonMismatch[] = []

  compareValue({
    mismatches,
    matchedAnnotations,
    expectedAnnotations,
    target: { metric: 'final_total' },
    expected: fixture.expectedTotals.finalTotal,
    actual: artifacts.pricingSummary.finalTotal,
  })

  const expectedRoomIds = fixture.expectedTotals.rooms.map((room) => room.roomId)
  const actualRoomIds = [...roomTotals.keys()]
  const roomIds = [...new Set([...expectedRoomIds, ...actualRoomIds])].sort()

  for (const roomId of roomIds) {
    const expected = fixture.expectedTotals.rooms.find((room) => room.roomId === roomId)?.total ?? 'missing'
    const actual = roomTotals.get(roomId) ?? 'missing'
    compareValue({
      mismatches,
      matchedAnnotations,
      expectedAnnotations,
      target: { metric: 'room_total', roomId },
      expected,
      actual,
    })
  }

  const families = Object.keys(fixture.expectedTotals.scopeTotals) as EstimateV2CanonicalScopeFamily[]
  for (const family of families) {
    const expectedRows = fixture.expectedTotals.scopeTotals[family]
    const actualRows = scopeTotals[family]
    const scopeIds = [...new Set([...expectedRows.map((row) => row.scopeId), ...actualRows.keys()])].sort()

    for (const scopeId of scopeIds) {
      const expectedRow = expectedRows.find((row) => row.scopeId === scopeId)
      const actualRow = actualRows.get(scopeId)
      compareValue({
        mismatches,
        matchedAnnotations,
        expectedAnnotations,
        target: {
          metric: 'scope_total',
          family,
          scopeId,
          roomId: expectedRow?.roomId ?? actualRow?.roomId,
        },
        expected: expectedRow?.total ?? 'missing',
        actual: actualRow?.total ?? 'missing',
      })
    }
  }

  const unmatchedExpectedMismatchAnnotations = expectedAnnotations.filter(
    (annotation) => !matchedAnnotations.includes(annotation)
  )

  return {
    fixture,
    mismatches: mismatches.sort((left, right) => mismatchSortKey(left).localeCompare(mismatchSortKey(right))),
    expectedMismatchAnnotations: expectedAnnotations,
    matchedExpectedMismatchAnnotations: matchedAnnotations,
    unmatchedExpectedMismatchAnnotations,
  }
}

function formatValue(value: number | 'missing') {
  if (value === 'missing') return value
  return value.toFixed(2)
}

function formatTarget(target: EstimateV2HistoricalComparisonTarget) {
  if (target.metric === 'final_total') return 'final_total'
  if (target.metric === 'room_total') return `room_total room=${target.roomId}`
  return `scope_total family=${target.family} scope=${target.scopeId}${target.roomId ? ` room=${target.roomId}` : ''}`
}

export function formatEstimateV2HistoricalComparison(
  result: EstimateV2HistoricalComparisonResult
): string {
  const lines = [
    `Estimator V2 historical comparison failed for "${result.fixture.scenarioName}"`,
    `Description: ${result.fixture.scenarioDescription}`,
  ]

  if (result.fixture.metadata) {
    lines.push(
      `Fixture metadata: sourceType=${result.fixture.metadata.sourceType} expectedTotalSource=${result.fixture.metadata.expectedTotalSource}`
    )
  }

  if ((result.fixture.comparisonNotes ?? []).length > 0) {
    lines.push('Fixture notes:')
    for (const note of result.fixture.comparisonNotes ?? []) {
      lines.push(`- ${note}`)
    }
  }

  if ((result.fixture.knownDifferenceNotes ?? []).length > 0) {
    lines.push('Known difference notes:')
    for (const note of result.fixture.knownDifferenceNotes ?? []) {
      lines.push(`- ${note}`)
    }
  }

  if (result.mismatches.length === 0 && result.unmatchedExpectedMismatchAnnotations.length === 0) {
    lines.push('No mismatches detected.')
    return lines.join('\n')
  }

  if (result.mismatches.length > 0) {
    lines.push('Observed mismatches:')
    for (const mismatch of result.mismatches) {
      lines.push(
        `- [${mismatch.category}] ${formatTarget(mismatch.target)} expected=${formatValue(mismatch.expected)} actual=${formatValue(mismatch.actual)}`
      )
      if (mismatch.note) {
        lines.push(`  classification note: ${mismatch.note}`)
      }
    }
  }

  if (result.unmatchedExpectedMismatchAnnotations.length > 0) {
    lines.push('Expected mismatch annotations not observed:')
    for (const annotation of result.unmatchedExpectedMismatchAnnotations) {
      lines.push(
        `- [${annotation.category}] ${formatTarget(
          annotation.metric === 'final_total'
            ? { metric: 'final_total' }
            : annotation.metric === 'room_total'
              ? { metric: 'room_total', roomId: annotation.roomId ?? '' }
              : {
                  metric: 'scope_total',
                  family: annotation.family ?? 'walls',
                  scopeId: annotation.scopeId ?? '',
                  roomId: annotation.roomId,
                }
        )} note=${annotation.note}`
      )
    }
  }

  return lines.join('\n')
}

export function assertEstimateV2HistoricalComparison(
  fixtureInput: EstimateV2HistoricalComparisonScenarioInput
) {
  const result = runEstimateV2HistoricalComparison(fixtureInput)
  const hasUnexpectedMismatch = result.mismatches.some((mismatch) => mismatch.category === 'actual_defect')
  if (hasUnexpectedMismatch || result.unmatchedExpectedMismatchAnnotations.length > 0) {
    throw new Error(formatEstimateV2HistoricalComparison(result))
  }
  return result
}
