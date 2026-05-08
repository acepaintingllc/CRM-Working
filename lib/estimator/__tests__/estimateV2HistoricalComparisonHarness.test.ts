import test from 'node:test'

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest')
  const {
    exteriorTrimFixture,
    fullMasterBedroomFixture,
    simpleHallwayRepaintFixture,
    simpleNoOverridesFixture,
  } = await import('../__fixtures__/canonical/index.ts')
  const {
    assertEstimateV2HistoricalComparison,
    formatEstimateV2HistoricalComparison,
    runEstimateV2HistoricalComparison,
  } = await import('./estimateV2HistoricalComparisonHarness.ts')

  describe('Estimator V2 historical comparison harness', () => {
    it('matches the canonical simple scenario with no annotated mismatches', () => {
      const result = assertEstimateV2HistoricalComparison(simpleNoOverridesFixture)

      expect(result.mismatches).toHaveLength(0)
      expect(result.unmatchedExpectedMismatchAnnotations).toHaveLength(0)
      expect(
        formatEstimateV2HistoricalComparison(
          runEstimateV2HistoricalComparison(simpleNoOverridesFixture)
        )
      ).toContain('No mismatches detected.')
    })
  })

  describe('Estimator V2 historical comparison harness for new historical fixtures', () => {
    for (const fixture of [
      simpleHallwayRepaintFixture,
      fullMasterBedroomFixture,
      exteriorTrimFixture,
    ]) {
      it(`compares ${fixture.scenarioName}`, () => {
        const result = runEstimateV2HistoricalComparison(fixture)
        expect(result.unmatchedExpectedMismatchAnnotations).toHaveLength(0)

        const unexpected = result.mismatches.filter((mismatch) => mismatch.category === 'actual_defect')
        if (unexpected.length > 0) {
          throw new Error(formatEstimateV2HistoricalComparison(result))
        }

        expect(result.mismatches).toHaveLength(0)
      })
    }
  })

  it('prints metadata, classification, and local notes for annotated mismatches', () => {
    const fixture = structuredClone(simpleHallwayRepaintFixture)
    fixture.expectedTotals.finalTotal = 500
    fixture.expectedTotals.rooms[0].total = 500
    fixture.knownDifferenceNotes = ['Example legacy hallway snapshot rounded trim labor differently.']
    fixture.expectedMismatches = [
      {
        metric: 'final_total',
        category: 'expected_rounding_difference',
        note: 'Legacy snapshot rounded the trim portion before room rollup.',
      },
      {
        metric: 'room_total',
        roomId: 'H001',
        category: 'expected_rounding_difference',
        note: 'Legacy hallway room total used the same earlier rounding path.',
      },
    ]

    const result = runEstimateV2HistoricalComparison(fixture)
    const output = formatEstimateV2HistoricalComparison(result)

    expect(output).toContain('Fixture metadata: sourceType=manually_crafted expectedTotalSource=hand_verified')
    expect(output).toContain('Known difference notes:')
    expect(output).toContain('[expected_rounding_difference] final_total')
    expect(output).toContain('classification note: Legacy snapshot rounded the trim portion before room rollup.')
  })
} else {
  test('Estimator V2 historical comparison harness smoke test runs under Vitest', { skip: true }, () => {})
}
