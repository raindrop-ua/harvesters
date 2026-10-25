import { describe, expect, it } from 'vitest'
import { crystalStage, mineralGrade } from './mineralVisuals'

describe('readable mineral depletion', () => {
  it('progressively removes individual Blender prisms between full and empty', () => {
    const counts = [1, 0.75, 0.5, 0.25, 0].map(
      (f) =>
        Array.from({ length: 7 }, (_, i) => crystalStage(f, i, 7)).filter(
          (s) => s.visible,
        ).length,
    )
    expect(counts).toEqual([7, 6, 4, 2, 0])
    expect(crystalStage(0.5, 3, 7).scale).toBeCloseTo(0.55)
    expect([1, 0.7, 0.5, 0.2, 0].map(mineralGrade)).toEqual([
      'RICH',
      'WORKED',
      'LOW',
      'TRACE',
      'DEPLETED',
    ])
  })
})
