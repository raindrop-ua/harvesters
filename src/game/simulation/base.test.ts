import { describe, expect, it } from 'vitest'
import { config } from '../config'
import { World, layout } from './World'
import { Simulation } from './Simulation'

describe('construction yard placement', () => {
  it('reserves its full footprint and leaves an eight-meter passage beside the refinery', () => {
    const world = new World(),
      yard = layout.courtyard,
      refinery = layout.refinery
    const cells = world.grid.cells.filter((cell) => cell.occupiedBy === yard.id)
    expect(cells).toHaveLength(yard.width * yard.depth)
    expect(cells.every((cell) => !cell.walkable && !cell.buildable)).toBe(true)
    expect((refinery.x - yard.x - yard.width) * world.grid.cellSize).toBe(8)
    for (let z = yard.z; z < refinery.z + refinery.depth; z++)
      for (let x = yard.x + yard.width; x < refinery.x; x++)
        expect(world.grid.isWalkable({ x, z })).toBe(true)
    expect(world.courtyardPosition.x).toBe(-38)
    expect(world.courtyardPosition.z).toBe(3)
  })

  it('drives a real harvester through the passage and rejects orders inside the yard', () => {
    const world = new World(undefined, [{ id: 'passage-test', x: 19, z: 27 }]),
      sim = new Simulation(world),
      unit = world.units[0],
      destination = { x: 19, z: 37 }
    expect(
      sim.commands.enqueue({
        type: 'MOVE',
        unitId: unit.id,
        destination: layout.courtyard,
      }).accepted,
    ).toBe(false)
    expect(
      sim.commands.enqueue({ type: 'MOVE', unitId: unit.id, destination })
        .accepted,
    ).toBe(true)
    sim.step(1 / config.tickRate)
    expect(unit.path.length).toBeGreaterThan(0)
    expect(
      unit.path.every(
        (cell) =>
          cell.x >= layout.courtyard.x + layout.courtyard.width &&
          cell.x < layout.refinery.x,
      ),
    ).toBe(true)
    for (let i = 0; i < 60 * config.tickRate && unit.state !== 'STOPPED'; i++) {
      sim.step(1 / config.tickRate)
      expect(world.grid.isWalkable(world.grid.worldToGrid(unit.position))).toBe(
        true,
      )
    }
    expect(unit.state).toBe('STOPPED')
    expect(unit.position).toEqual(world.grid.gridToWorld(destination))
  })
})
