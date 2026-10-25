import { describe, expect, it } from 'vitest'
import { config } from '../config'
import { Simulation } from './Simulation'
import { World, layout } from './World'
import { FixedLoop } from '../core/FixedLoop'
import { Refinery } from '../economy/Economy'
import type { HarvesterState } from '../types'

const dt = 1 / config.tickRate
const singleSimulation = () =>
  new Simulation(
    new World(undefined, layout.harvesters.slice(0, 1), {
      ...config.minerals,
      regenerationRate: 0,
    }),
  )
function until(
  sim: Simulation,
  predicate: () => boolean,
  seconds = 180,
): Set<HarvesterState> {
  const states = new Set<HarvesterState>()
  for (let i = 0; i < seconds / dt && !predicate(); i++) {
    states.add(sim.world.units[0].state)
    sim.step(dt)
  }
  expect(
    predicate(),
    `timed out in ${sim.world.units[0].state}: ${sim.world.units[0].message}`,
  ).toBe(true)
  return states
}

describe('autonomous harvesting', () => {
  it('eventually extracts the entire finite map and idles with no resources lost', () => {
    const sim = singleSimulation(),
      w = sim.world
    const total = w.deposits.reduce((sum, d) => sum + d.amount, 0)
    until(
      sim,
      () =>
        w.deposits.every((d) => d.amount === 0) &&
        w.units[0].cargo === 0 &&
        w.units[0].state === 'IDLE',
      1800,
    )
    expect(w.economy.balances.mineral).toBeCloseTo(total)
    expect(w.extracted).toBeCloseTo(total)
  })
  it('completes repeated cycles and conserves all minerals', () => {
    const sim = singleSimulation(),
      w = sim.world
    const total = w.deposits.reduce((sum, d) => sum + d.amount, 0)
    const states = until(sim, () => w.deliveries >= 3)
    for (const state of [
      'FIND_RESOURCE',
      'MOVE_TO_RESOURCE',
      'HARVEST',
      'CARGO_FULL',
      'MOVE_TO_REFINERY',
      'DOCK',
      'UNLOAD',
    ])
      expect(states.has(state as HarvesterState)).toBe(true)
    expect(w.economy.balances.mineral).toBeCloseTo(w.settings.capacity * 3)
    expect(
      w.deposits.reduce((sum, d) => sum + d.amount, 0) +
        w.units[0].cargo +
        w.economy.balances.mineral,
    ).toBeCloseTo(total)
  })
  it('respects capacity and never crosses a blocked cell during its full cycle', () => {
    const sim = singleSimulation(),
      w = sim.world
    let maximum = 0
    for (let i = 0; i < 2400; i++) {
      sim.step(dt)
      maximum = Math.max(maximum, w.units[0].cargo)
      expect(w.units[0].cargo).toBeGreaterThanOrEqual(0)
      expect(w.units[0].cargo).toBeLessThanOrEqual(w.units[0].capacity + 1e-8)
      expect(w.grid.isWalkable(w.grid.worldToGrid(w.units[0].position))).toBe(
        true,
      )
      expect(w.units[0].position.y).toBeCloseTo(
        w.grid.heightAt(w.units[0].position.x, w.units[0].position.z),
      )
    }
    expect(maximum).toBeCloseTo(w.units[0].capacity)
  })
  it('depletes a partial load, releases occupancy, and returns every last mineral', () => {
    const sim = singleSimulation(),
      w = sim.world
    for (const d of w.deposits) {
      d.amount = 0
      w.grid.release(d.id)
    }
    const d = w.deposits[3]
    d.amount = 17.5
    until(sim, () => w.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(17.5)
    expect(d.amount).toBe(0)
    expect(w.grid.get(d.cell)?.occupiedBy).toBeUndefined()
    until(sim, () => w.units[0].state === 'IDLE')
    expect(w.units[0].message).toContain('depleted')
  })
  it('waits safely when there are no available resources', () => {
    const sim = singleSimulation()
    for (const d of sim.world.deposits) d.amount = 0
    for (let i = 0; i < 400; i++) sim.step(dt)
    expect(sim.world.economy.balances.mineral).toBe(0)
    expect(sim.world.units[0].state).toBe('IDLE')
    expect(sim.world.units[0].path).toEqual([])
  })
  it('bounds retries when every deposit is unreachable', () => {
    const sim = singleSimulation(),
      w = sim.world
    for (const deposit of w.deposits)
      w.grid.occupy(
        { x: deposit.cell.x - 4, z: deposit.cell.z - 4 },
        9,
        9,
        'wall',
        'rock',
      )
    sim.step(dt)
    sim.step(dt)
    expect(w.units[0].state).toBe('IDLE')
    const retry = w.units[0].retryAt
    for (let i = 0; i < 20; i++) sim.step(dt)
    expect(w.units[0].retryAt).toBe(retry)
    expect(w.units[0].message).toContain('reachable')
  })
  it('retains cargo if the refinery is missing and resumes when it returns', () => {
    const sim = singleSimulation(),
      w = sim.world
    w.units[0].cargo = 45
    const refinery = w.refinery
    w.refinery = undefined
    for (let i = 0; i < 100; i++) sim.step(dt)
    expect(w.units[0].cargo).toBe(45)
    expect(w.units[0].message).toContain('No refinery')
    w.refinery = refinery
    until(sim, () => w.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(45)
  })
  it('retains cargo at a blocked dock and recovers without teleporting', () => {
    const sim = singleSimulation(),
      w = sim.world
    w.units[0].cargo = 32
    const dock = w.refinery!.dock
    w.grid.occupy(dock, 1, 1, 'dock-obstruction', 'rock')
    for (let i = 0; i < 100; i++) sim.step(dt)
    expect(w.units[0].cargo).toBe(32)
    expect(w.units[0].message).toContain('Dock unreachable')
    w.grid.release('dock-obstruction')
    until(sim, () => w.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(32)
  })
  it('replans an invalidated route and handles refinery removal during travel', () => {
    const sim = singleSimulation(),
      w = sim.world
    until(sim, () => w.units[0].state === 'MOVE_TO_RESOURCE')
    const next = w.units[0].path[w.units[0].pathIndex]
    w.grid.occupy(next, 1, 1, 'new-rock', 'rock')
    sim.step(dt)
    expect(w.units[0].state).toBe('FIND_RESOURCE')
    w.grid.release('new-rock')
    until(sim, () => w.units[0].state === 'MOVE_TO_REFINERY')
    const cargo = w.units[0].cargo
    w.refinery = undefined
    sim.step(dt)
    expect(w.units[0].state).toBe('IDLE')
    expect(w.units[0].cargo).toBe(cargo)
  })
})

describe('commands and docking contracts', () => {
  it('validates commands, executes at tick boundaries, and makes a real move', () => {
    const sim = singleSimulation(),
      u = sim.world.units[0]
    expect(
      sim.commands.enqueue({ type: 'STOP', unitId: 'unknown' }).accepted,
    ).toBe(false)
    expect(
      sim.commands.enqueue({
        type: 'MOVE',
        unitId: u.id,
        destination: { x: NaN, z: 2 },
      }).accepted,
    ).toBe(false)
    expect(
      sim.commands.enqueue({
        type: 'MOVE',
        unitId: u.id,
        destination: { x: 22, z: 27 },
      }).accepted,
    ).toBe(false)
    expect(
      sim.commands.enqueue({
        type: 'HARVEST',
        unitId: u.id,
        resourceId: 'missing',
      }).accepted,
    ).toBe(false)
    const start = { ...u.position }
    const destination = { x: 26, z: 35 }
    expect(
      sim.commands.enqueue({ type: 'MOVE', unitId: u.id, destination })
        .accepted,
    ).toBe(true)
    expect(u.position).toEqual(start)
    sim.step(dt)
    until(sim, () => u.state === 'STOPPED')
    expect(u.position).toEqual(sim.world.grid.gridToWorld(destination))
    expect(u.autonomous).toBe(false)
    sim.commands.enqueue({ type: 'AUTO', unitId: u.id })
    until(sim, () => u.state === 'HARVEST')
  })
  it('stops without losing cargo and supports explicit harvest / return orders', () => {
    const sim = singleSimulation(),
      w = sim.world,
      u = w.units[0]
    sim.commands.enqueue({
      type: 'HARVEST',
      unitId: u.id,
      resourceId: w.deposits[0].id,
    })
    sim.step(dt)
    expect(u.targetId).toBe(w.deposits[0].id)
    until(sim, () => u.cargo > 15)
    sim.commands.enqueue({ type: 'STOP', unitId: u.id })
    sim.step(dt)
    const cargo = u.cargo,
      p = { ...u.position }
    for (let i = 0; i < 30; i++) sim.step(dt)
    expect(u.position).toEqual(p)
    expect(u.cargo).toBe(cargo)
    sim.commands.enqueue({ type: 'RETURN_CARGO', unitId: u.id })
    until(sim, () => w.deliveries === 1)
    expect(w.economy.balances.mineral).toBeCloseTo(cargo)
  })
  it('reserves a dock for one unit and releases it explicitly', () => {
    const w = new World(),
      receiver = w.refinery as Refinery
    receiver.request('one')
    receiver.request('two')
    expect(receiver.reserve('one')).toBe(true)
    expect(receiver.reserve('two')).toBe(false)
    expect(receiver.canAccept('two')).toBe(false)
    receiver.release('one')
    expect(receiver.reserve('two')).toBe(true)
    expect(receiver.receiveResources('two', 'mineral', -1)).toBe(0)
    expect(receiver.receiveResources('two', 'mineral', Infinity)).toBe(0)
  })
})

describe('fixed-step clock', () => {
  it('produces identical simulation state at 30 and 144 rendering frames per second', () => {
    const run = (fps: number) => {
      const sim = singleSimulation(),
        loop = new FixedLoop(sim)
      for (let i = 0; i < fps * 60; i++) loop.advance(1 / fps)
      return sim.world
    }
    const a = run(30),
      b = run(144)
    expect(a.time).toBeCloseTo(b.time)
    expect(a.units[0].position.x).toBeCloseTo(b.units[0].position.x)
    expect(a.units[0].position.z).toBeCloseTo(b.units[0].position.z)
    expect(a.economy.balances.mineral).toBeCloseTo(b.economy.balances.mineral)
  })
  it('caps catch-up work, ignores invalid time, and freezes when paused', () => {
    const sim = singleSimulation(),
      loop = new FixedLoop(sim)
    loop.speed = 4
    loop.advance(10000)
    expect(sim.world.time).toBeLessThanOrEqual(
      config.maxCatchUpSteps / config.tickRate + 1e-8,
    )
    const time = sim.world.time
    loop.paused = true
    loop.advance(10)
    loop.advance(NaN)
    loop.advance(-1)
    expect(sim.world.time).toBe(time)
  })
})
