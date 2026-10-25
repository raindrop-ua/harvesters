import { describe, expect, it } from 'vitest'
import { Grid } from './Grid'
import { Pathfinder } from './Pathfinder'

const flat = (width = 8) => new Grid(width, 2, Array((width + 1) ** 2).fill(0))

describe('logical grid', () => {
  it('round-trips cell centers and rejects the world boundary outside the map', () => {
    const grid = flat()
    for (const cell of grid.cells)
      expect(grid.worldToGrid(grid.gridToWorld(cell))).toEqual({
        x: cell.x,
        z: cell.z,
      })
    expect(grid.get(grid.worldToGrid({ x: 8, z: 0 }))).toBeUndefined()
    expect(grid.contains({ x: NaN, z: 0 })).toBe(false)
    expect(grid.contains({ x: 1.5, z: 0 })).toBe(false)
  })
  it('samples the actual triangle surface rather than an unrelated bilinear heightfield', () => {
    const grid = new Grid(1, 2, [0, 2, 4, 8])
    expect(grid.heightAt(-0.5, -0.5)).toBeCloseTo(1.5)
    expect(grid.heightAt(0.5, 0.5)).toBeCloseTo(5.5)
    expect(grid.heightAt(1, 1)).toBeCloseTo(8, 4)
  })
  it('occupies and releases footprints without touching unrelated entities', () => {
    const grid = flat()
    grid.occupy({ x: 2, z: 2 }, 3, 2, 'refinery', 'building')
    grid.occupy({ x: 6, z: 6 }, 1, 1, 'rock', 'rock')
    expect(grid.cells.filter((c) => c.occupiedBy === 'refinery')).toHaveLength(
      6,
    )
    expect(grid.isWalkable({ x: 3, z: 3 })).toBe(false)
    expect(grid.get({ x: 3, z: 3 })?.buildable).toBe(false)
    grid.release('refinery')
    expect(grid.isWalkable({ x: 3, z: 3 })).toBe(true)
    expect(grid.isWalkable({ x: 6, z: 6 })).toBe(false)
  })
  it('preserves overlapping obstacles and original terrain restrictions on release', () => {
    const grid = flat(),
      p = { x: 3, z: 3 }
    grid.get(p)!.walkable = false
    grid.occupy(p, 1, 1, 'rock', 'rock')
    grid.occupy(p, 1, 1, 'mineral', 'mineral')
    grid.release('mineral')
    expect(grid.get(p)?.occupiedBy).toBe('rock')
    expect(grid.isWalkable(p)).toBe(false)
    grid.release('rock')
    expect(grid.isWalkable(p)).toBe(false)
  })
})

describe('deterministic A*', () => {
  it('routes around footprints with no diagonal corner-cutting', () => {
    const grid = flat()
    grid.occupy({ x: 3, z: 1 }, 2, 5, 'building', 'building')
    const nav = new Pathfinder(grid),
      start = { x: 1, z: 3 },
      end = { x: 6, z: 3 }
    const path = nav.findPath(start, end)!
    expect(path.length).toBeGreaterThan(5)
    let previous = start
    for (const step of path) {
      expect(grid.canStep(previous, step)).toBe(true)
      previous = step
    }
    expect(path.at(-1)).toEqual(end)
    expect(nav.findPath(start, end)).toEqual(path)
  })
  it('rejects blocked, unreachable, and invalid destinations', () => {
    const grid = flat(),
      nav = new Pathfinder(grid)
    grid.occupy({ x: 4, z: 0 }, 1, 8, 'wall', 'rock')
    expect(nav.findPath({ x: 1, z: 1 }, { x: 6, z: 1 })).toBeNull()
    expect(nav.findPath({ x: 1, z: 1 }, { x: 4, z: 1 })).toBeNull()
    expect(nav.findPath({ x: -1, z: 1 }, { x: 2, z: 1 })).toBeNull()
    expect(nav.findPath({ x: 1, z: 1 }, { x: 1, z: 1 })).toEqual([])
  })
  it('prefers a longer inexpensive route over expensive terrain', () => {
    const grid = flat()
    for (let x = 2; x <= 5; x++) grid.get({ x, z: 3 })!.movementCost = 20
    const path = new Pathfinder(grid, false).findPath(
      { x: 1, z: 3 },
      { x: 6, z: 3 },
    )!
    expect(path.some((p) => p.z !== 3)).toBe(true)
    expect(path.filter((p) => p.z === 3 && p.x >= 2 && p.x <= 5)).toHaveLength(
      0,
    )
  })
})
