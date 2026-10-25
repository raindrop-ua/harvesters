import { describe, expect, it } from 'vitest'
import { Simulation } from './Simulation'
import { World, layout } from './World'
import { config } from '../config'

describe('player movement orders', () => {
  it('rejects a walkable but unreachable goal without interrupting autonomous work', () => {
    const sim = new Simulation(
        new World(undefined, layout.harvesters.slice(0, 1)),
      ),
      w = sim.world,
      u = w.units[0],
      goal = { x: 6, z: 6 }
    for (let z = 5; z <= 7; z++)
      for (let x = 5; x <= 7; x++) {
        if (x === 6 && z === 6) continue
        w.grid.occupy({ x, z }, 1, 1, 'wall', 'rock')
      }
    expect(w.grid.isWalkable(goal)).toBe(true)
    expect(sim.previewMove(u.id, goal)).toEqual({
      accepted: false,
      reason: 'No route to destination',
    })
    expect(
      sim.commands.enqueue({ type: 'MOVE', unitId: u.id, destination: goal })
        .accepted,
    ).toBe(false)
    sim.step(0.05)
    expect(u.autonomous).toBe(true)
    expect(u.state).toBe('FIND_RESOURCE')
    expect(u.cargo).toBe(0)
  })

  it('accounts for other vehicles and the occupied refinery approach when previewing a move', () => {
    const sim = new Simulation(),
      w = sim.world,
      [a, b] = w.units
    expect(sim.previewMove(a.id, w.grid.worldToGrid(b.position)).accepted).toBe(
      false,
    )
    const receiver = w.refinery!
    receiver.request(b.id)
    receiver.reserve(b.id)
    expect(w.grid.isWalkable(receiver.entry)).toBe(true)
    expect(sim.previewMove(a.id, receiver.entry).accepted).toBe(false)
    receiver.release(b.id)
    expect(sim.previewMove(a.id, receiver.entry).accepted).toBe(true)
  })

  it('revalidates before execution if a goal becomes blocked after the click', () => {
    const sim = new Simulation(),
      w = sim.world,
      u = w.units[0],
      goal = { x: 19, z: 37 }
    expect(
      sim.commands.enqueue({ type: 'MOVE', unitId: u.id, destination: goal })
        .accepted,
    ).toBe(true)
    w.grid.occupy(goal, 1, 1, 'new-obstruction', 'rock')
    sim.step(0.05)
    expect(u.autonomous).toBe(true)
    expect(u.state).not.toBe('MOVE')
  })

  it('retains cargo, waits at the destination, and resumes extraction only on Autopilot', () => {
    const sim = new Simulation(
        new World(undefined, layout.harvesters.slice(0, 1)),
      ),
      w = sim.world,
      u = w.units[0],
      goal = { x: 19, z: 37 }
    u.cargo = 25
    expect(
      sim.commands.enqueue({ type: 'MOVE', unitId: u.id, destination: goal })
        .accepted,
    ).toBe(true)
    for (let i = 0; i < 60 * config.tickRate; i++) sim.step(1 / config.tickRate)
    expect(u.state).toBe('STOPPED')
    expect(u.position).toEqual(w.grid.gridToWorld(goal))
    expect(u.cargo).toBe(25)
    expect(w.economy.balances.mineral).toBe(0)
    sim.commands.enqueue({ type: 'AUTO', unitId: u.id })
    for (let i = 0; i < 180 * config.tickRate && u.deliveries === 0; i++)
      sim.step(1 / config.tickRate)
    expect(u.autonomous).toBe(true)
    expect(u.deliveries).toBeGreaterThan(0)
  })
})
