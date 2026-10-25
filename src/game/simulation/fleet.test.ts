import { describe, expect, it } from 'vitest'
import { config } from '../config'
import { Simulation, angleDelta } from './Simulation'
import { World, layout } from './World'
import type { HarvesterState } from '../types'

const dt = 1 / config.tickRate
function advanceUntil(
  sim: Simulation,
  predicate: () => boolean,
  seconds = 120,
) {
  for (let i = 0; i < seconds / dt && !predicate(); i++) sim.step(dt)
  expect(
    predicate(),
    sim.world.units
      .map(
        (u) =>
          `${u.id}: ${u.state} / ${u.message} / (${u.position.x.toFixed(1)},${u.position.z.toFixed(1)})`,
      )
      .join('\n'),
  ).toBe(true)
}
function simultaneousReturns() {
  const sim = new Simulation()
  for (const u of sim.world.units) {
    u.cargo = u.capacity
    sim.commands.enqueue({ type: 'RETURN_CARGO', unitId: u.id })
  }
  sim.step(dt)
  return sim
}

describe('two harvesters and one refinery', () => {
  it('queues simultaneous arrivals fairly, holds cargo while waiting, and keeps the lock until clear', () => {
    const sim = simultaneousReturns(),
      w = sim.world,
      [a, b] = w.units
    expect(w.refinery!.queue).toEqual([a.id, b.id])
    advanceUntil(sim, () => a.state === 'UNLOAD' && b.state === 'WAIT_FOR_DOCK')
    const waitingPosition = { ...b.position }
    expect(b.cargo).toBe(b.capacity)
    for (let i = 0; i < 20; i++) sim.step(dt)
    expect(b.position).toEqual(waitingPosition)
    expect(b.cargo).toBe(b.capacity)
    expect(w.refinery!.reservedBy).toBe(a.id)
    advanceUntil(sim, () => a.state === 'UNDOCK')
    expect(w.refinery!.reservedBy).toBe(a.id)
    expect(b.state).toBe('WAIT_FOR_DOCK')
    advanceUntil(sim, () => a.state === 'LEAVE_REFINERY')
    expect(w.refinery!.reservedBy).toBe(a.id)
    expect(b.state).toBe('WAIT_FOR_DOCK')
    advanceUntil(sim, () => b.state === 'UNLOAD')
    expect(w.refinery!.reservedBy).toBe(b.id)
    expect(a.deliveries).toBe(1)
    advanceUntil(sim, () => b.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(a.capacity + b.capacity)
  })
  it('completes a finite shift with regeneration disabled, without overlap or resource loss', () => {
    const sim = new Simulation(
        new World(undefined, undefined, {
          ...config.minerals,
          regenerationRate: 0,
        }),
      ),
      w = sim.world
    const total = w.deposits.reduce((sum, d) => sum + d.amount, 0)
    const states = new Set<HarvesterState>()
    let complete = false
    for (let i = 0; i < 1800 / dt; i++) {
      sim.step(dt)
      for (const u of w.units) {
        states.add(u.state)
        expect(u.cargo).toBeGreaterThanOrEqual(0)
        expect(u.cargo).toBeLessThanOrEqual(u.capacity + 1e-8)
        expect(w.grid.isWalkable(w.grid.worldToGrid(u.position))).toBe(true)
        if (u.state === 'UNLOAD') {
          expect(w.refinery!.reservedBy).toBe(u.id)
          const dock = w.grid.gridToWorld(w.refinery!.dock)
          expect(
            Math.hypot(u.position.x - dock.x, u.position.z - dock.z),
          ).toBeLessThanOrEqual(w.settings.dockingPositionTolerance)
          expect(
            Math.abs(angleDelta(u.heading, w.refinery!.heading)),
          ).toBeLessThanOrEqual(w.settings.dockingAngleTolerance)
        }
      }
      expect(w.units.filter((u) => u.state === 'UNLOAD')).toHaveLength(
        w.units.some((u) => u.state === 'UNLOAD') ? 1 : 0,
      )
      for (const [index, a] of w.vehicles.entries())
        for (const b of w.vehicles.slice(index + 1))
          expect(
            Math.hypot(
              a.position.x - b.position.x,
              a.position.z - b.position.z,
            ),
          ).toBeGreaterThanOrEqual(w.settings.unitSeparation - 0.03)
      expect(
        w.deposits.reduce((sum, d) => sum + d.amount, 0) +
          w.units.reduce((sum, u) => sum + u.cargo, 0) +
          w.economy.balances.mineral,
      ).toBeCloseTo(total, 5)
      if (
        w.deposits.every((d) => d.amount === 0) &&
        w.units.every((u) => u.cargo === 0 && u.state === 'IDLE')
      ) {
        complete = true
        break
      }
    }
    expect(
      complete,
      w.units.map((u) => `${u.state}: ${u.message}`).join('\n'),
    ).toBe(true)
    expect(w.units.every((u) => u.deliveries > 0)).toBe(true)
    expect(w.economy.balances.mineral).toBeCloseTo(total)
    expect(states.has('WAIT_FOR_DOCK')).toBe(true)
  })
  it('cancels a stopped waiting request without losing cargo or blocking the other unit', () => {
    const sim = simultaneousReturns(),
      w = sim.world,
      [a, b] = w.units
    advanceUntil(sim, () => b.state === 'WAIT_FOR_DOCK' && a.state === 'UNLOAD')
    sim.commands.enqueue({ type: 'STOP', unitId: b.id })
    sim.step(dt)
    expect(b.state).toBe('STOPPED')
    expect(w.refinery!.queue).not.toContain(b.id)
    expect(b.cargo).toBe(b.capacity)
    advanceUntil(sim, () => a.deliveries === 1 && !w.refinery!.reservedBy)
    sim.commands.enqueue({ type: 'AUTO', unitId: b.id })
    advanceUntil(sim, () => b.deliveries === 1)
  })
  it('routes orders by entity id rather than affecting the first unit', () => {
    const sim = new Simulation(),
      [a, b] = sim.world.units
    sim.commands.enqueue({ type: 'STOP', unitId: b.id })
    sim.step(dt)
    advanceUntil(sim, () => a.state === 'HARVEST')
    expect(b.state).toBe('STOPPED')
    expect(b.cargo).toBe(0)
    expect(
      sim.commands.enqueue({
        type: 'MOVE',
        unitId: 'missing',
        destination: { x: 1, z: 1 },
      }).accepted,
    ).toBe(false)
  })
})

describe('fixed unloading pose', () => {
  function atDock() {
    const sim = new Simulation(
        new World(undefined, layout.harvesters.slice(0, 1)),
      ),
      w = sim.world,
      u = w.units[0],
      receiver = w.refinery!
    receiver.request(u.id)
    receiver.reserve(u.id)
    u.position = w.grid.gridToWorld(receiver.dock)
    u.previousPosition = { ...u.position }
    u.state = 'DOCK'
    u.heading = 0
    u.cargo = 75
    return sim
  }
  it('turns nose first before transferring any cargo, and realigns if disturbed', () => {
    const sim = atDock(),
      w = sim.world,
      u = w.units[0]
    sim.step(dt)
    expect(u.state).toBe('DOCK')
    expect(u.cargo).toBe(75)
    expect(w.economy.balances.mineral).toBe(0)
    advanceUntil(sim, () => u.state === 'UNLOAD')
    expect(
      Math.abs(angleDelta(u.heading, w.refinery!.heading)),
    ).toBeLessThanOrEqual(w.settings.dockingAngleTolerance)
    expect(w.economy.balances.mineral).toBe(0)
    u.heading = 0
    sim.step(dt)
    expect(u.state).toBe('DOCK')
    expect(u.cargo).toBe(75)
    expect(w.economy.balances.mineral).toBe(0)
    advanceUntil(sim, () => u.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(75)
  })
  it('refuses to unload from an incorrect position', () => {
    const sim = atDock(),
      w = sim.world,
      u = w.units[0]
    u.state = 'UNLOAD'
    u.heading = w.refinery!.heading
    u.position.x += 0.5
    sim.step(dt)
    expect(u.cargo).toBe(75)
    expect(w.economy.balances.mineral).toBe(0)
    expect(u.state).toBe('DOCK')
  })
  it('does not release an occupied port on Hold and resumes safely', () => {
    const sim = atDock(),
      w = sim.world,
      u = w.units[0]
    sim.commands.enqueue({ type: 'STOP', unitId: u.id })
    sim.step(dt)
    expect(w.refinery!.reservedBy).toBe(u.id)
    expect(u.state).toBe('STOPPED')
    sim.commands.enqueue({ type: 'AUTO', unitId: u.id })
    advanceUntil(sim, () => u.deliveries === 1)
    advanceUntil(sim, () => !w.refinery!.reservedBy)
  })
})
