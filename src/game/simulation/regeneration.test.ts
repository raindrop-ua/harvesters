import { describe, expect, it } from 'vitest'
import { config } from '../config'
import { FixedLoop } from '../core/FixedLoop'
import { Simulation } from './Simulation'
import { isRegenerating } from './MineralRegeneration'
import { World, layout } from './World'

const dt = 1 / config.tickRate
function advance(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.round(seconds / dt); i++) sim.step(dt)
}
function emptyFields(world: World) {
  for (const deposit of world.deposits) deposit.amount = 0
}

describe('slow mineral regeneration', () => {
  it('restores 12 minerals per minute, caps each field, and accounts only for actual growth', () => {
    const w = new World(undefined, []),
      sim = new Simulation(w),
      [empty, nearlyFull] = w.deposits
    empty.amount = 0
    nearlyFull.amount -= 1
    advance(sim, 60)
    expect(empty.amount).toBeCloseTo(12, 8)
    expect(nearlyFull.amount).toBe(nearlyFull.initialAmount)
    expect(w.regenerated).toBeCloseTo(13, 8)
    expect(w.deposits.slice(2).every((d) => d.amount === d.initialAmount)).toBe(
      true,
    )
    advance(sim, 3600)
    expect(w.deposits.every((d) => d.amount <= d.initialAmount)).toBe(true)
    expect(empty.amount).toBe(empty.initialAmount)
    expect(w.regenerated).toBeCloseTo(empty.initialAmount + 1, 7)
  })

  it('does not regenerate during extraction and resumes when the field is resting', () => {
    const w = new World(undefined, layout.harvesters.slice(0, 1)),
      sim = new Simulation(w),
      u = w.units[0],
      d = w.deposits[0]
    d.amount = 50
    const center = w.grid.gridToWorld(d.cell)
    Object.assign(u.position, center, { x: center.x + 5 })
    u.state = 'HARVEST'
    u.targetId = d.id
    expect(isRegenerating(w, d)).toBe(false)
    sim.step(dt)
    expect(d.amount).toBeCloseTo(50 - w.settings.harvestRate * dt)
    expect(w.regenerated).toBe(0)
    sim.commands.enqueue({ type: 'STOP', unitId: u.id })
    sim.step(dt)
    expect(isRegenerating(w, d)).toBe(true)
    expect(w.regenerated).toBeCloseTo(config.minerals.regenerationRate * dt)
    expect(u.cargo).toBeCloseTo(w.settings.harvestRate * dt)
  })

  it('waits for a useful reserve, then both autonomous units repeatedly deliver regenerated minerals', () => {
    const sim = new Simulation(),
      w = sim.world
    emptyFields(w)
    const revision = w.grid.revision
    advance(sim, 119)
    for (const unit of w.units) {
      expect(unit.state).toBe('IDLE')
      expect(unit.message).toContain('regrow')
      expect(unit.path).toEqual([])
      expect(unit.cargo).toBe(0)
    }
    expect(w.economy.balances.mineral).toBe(0)
    expect(w.deposits[0].amount).toBeCloseTo(23.8)
    for (let i = 0; i < 900 / dt; i++) {
      sim.step(dt)
      for (const u of w.units) {
        expect(w.grid.isWalkable(w.grid.worldToGrid(u.position))).toBe(true)
        expect(u.cargo).toBeGreaterThanOrEqual(0)
        expect(u.cargo).toBeLessThanOrEqual(u.capacity + 1e-8)
      }
      const [a, b] = w.units
      expect(
        Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z),
      ).toBeGreaterThanOrEqual(w.settings.unitSeparation - 0.03)
    }
    expect(w.units.every((u) => u.deliveries >= 2)).toBe(true)
    expect(w.economy.balances.mineral).toBeGreaterThan(240)
    const cargo = w.units.reduce((sum, u) => sum + u.cargo, 0)
    expect(w.extracted).toBeCloseTo(w.economy.balances.mineral + cargo, 7)
    expect(w.regenerated).toBeCloseTo(
      w.deposits.reduce((sum, d) => sum + d.amount, 0) +
        cargo +
        w.economy.balances.mineral,
      7,
    )
    // Empty renewable patches stay reserved throughout regrowth, never appearing under a path.
    expect(w.grid.revision).toBe(revision)
    for (const d of w.deposits)
      expect(w.grid.get(d.cell)?.occupiedBy).toBe(d.id)
  })

  it('keeps Hold orders intact while fields grow and accepts Autopilot afterwards', () => {
    const sim = new Simulation(),
      w = sim.world,
      [a, b] = w.units
    emptyFields(w)
    sim.commands.enqueue({ type: 'STOP', unitId: b.id })
    const parked = { ...b.position }
    advance(sim, 300)
    expect(a.deliveries).toBeGreaterThan(0)
    expect(b.state).toBe('STOPPED')
    expect(b.position).toEqual(parked)
    expect(b.cargo).toBe(0)
    sim.commands.enqueue({ type: 'AUTO', unitId: b.id })
    advance(sim, 180)
    expect(b.deliveries).toBeGreaterThan(0)
  })

  it('uses simulation time at any render rate and freezes on pause', () => {
    const run = (fps: number) => {
      const sim = new Simulation(new World(undefined, [])),
        loop = new FixedLoop(sim)
      emptyFields(sim.world)
      for (let i = 0; i < fps * 60; i++) loop.advance(1 / fps)
      return { sim, loop }
    }
    const a = run(30),
      b = run(144)
    expect(a.sim.world.deposits.map((d) => d.amount)).toEqual(
      b.sim.world.deposits.map((d) => d.amount),
    )
    expect(a.sim.world.deposits[0].amount).toBeCloseTo(12)
    a.loop.paused = true
    const grown = a.sim.world.regenerated
    for (let i = 0; i < 600; i++) a.loop.advance(1 / 60)
    expect(a.sim.world.regenerated).toBe(grown)
    a.loop.paused = false
    a.loop.speed = 4
    for (let i = 0; i < 900; i++) a.loop.advance(1 / 60)
    expect(a.sim.world.deposits[0].amount).toBeCloseTo(24)
  })

  it('supports fields smaller than the dispatch reserve without deadlocking them', () => {
    const w = new World(undefined, layout.harvesters.slice(0, 1)),
      sim = new Simulation(w)
    emptyFields(w)
    for (const d of w.deposits) d.initialAmount = 0
    w.deposits[0].initialAmount = 5
    advance(sim, 180)
    expect(w.units[0].deliveries).toBeGreaterThan(0)
    expect(w.economy.balances.mineral).toBeGreaterThanOrEqual(5)
    expect(w.deposits.slice(1).every((d) => d.amount === 0)).toBe(true)
  })
})
