import { describe, expect, it } from 'vitest'
import { Simulation } from './Simulation'
import { World } from './World'
import type { MapTarget } from '../types'

const advance = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) sim.step(0.05)
}

describe('contextual harvester orders', () => {
  it('resolves crystal and refinery clicks by unit capability without moving tanks into either footprint', () => {
    const sim = new Simulation(),
      w = sim.world
    const targets: MapTarget[] = [
      { kind: 'deposit', id: w.deposits[0].id, cell: w.deposits[0].cell },
      { kind: 'refinery', id: w.refinery!.id, cell: { x: 23, z: 28 } },
    ]
    const h = w.units[0]
    h.cargo = 12
    expect(sim.mapOrder(h.id, targets[0])?.type).toBe('HARVEST')
    expect(sim.mapOrder(h.id, targets[1])?.type).toBe('RETURN_CARGO')
    for (const tank of w.tanks)
      for (const target of targets) {
        expect(sim.mapOrder(tank.id, target)).toBeNull()
        expect(sim.previewMapOrder(tank.id, target).accepted).toBe(false)
        expect(sim.previewMove(tank.id, target.cell).accepted).toBe(false)
      }
    for (const type of ['HARVEST', 'RETURN_CARGO', 'AUTO'] as const)
      expect(
        sim.commands.enqueue({
          type,
          unitId: w.tanks[0].id,
          resourceId: w.deposits[0].id,
        }).accepted,
      ).toBe(false)
  })

  it('harvests the clicked deposit through an approach cell, then returns a partial load on command', () => {
    const sim = new Simulation(
        new World(
          undefined,
          [{ id: 'harvester-01', x: 22, z: 35 }],
          undefined,
          [],
        ),
      ),
      w = sim.world,
      h = w.units[0],
      d = w.deposits[2]
    const command = sim.mapOrder(h.id, {
      kind: 'deposit',
      id: d.id,
      cell: d.cell,
    })!
    expect(sim.commands.enqueue(command).accepted).toBe(true)
    sim.step(0.05)
    expect(h.targetId).toBe(d.id)
    expect(h.autonomous).toBe(true)
    for (let i = 0; i < 1000 && h.cargo < 20; i++) sim.step(0.05)
    expect(h.state).toBe('HARVEST')
    expect(h.cargo).toBeGreaterThanOrEqual(20)
    expect(h.cargo).toBeLessThan(h.capacity)
    const before = h.cargo
    expect(
      sim.commands.enqueue(
        sim.mapOrder(h.id, {
          kind: 'refinery',
          id: w.refinery!.id,
          cell: { x: 23, z: 28 },
        })!,
      ).accepted,
    ).toBe(true)
    for (let i = 0; i < 2000 && h.deliveries === 0; i++) sim.step(0.05)
    expect(h.deliveries).toBe(1)
    expect(w.economy.balances.mineral).toBeCloseTo(before)
    expect(h.cargo).toBe(0)
  })

  it('remembers a clicked field while unloading and visits it after clearing the dock', () => {
    const sim = new Simulation(
        new World(
          undefined,
          [{ id: 'harvester-01', x: 22, z: 35 }],
          undefined,
          [],
        ),
      ),
      w = sim.world,
      h = w.units[0],
      r = w.refinery!,
      d = w.deposits[4]
    r.request(h.id)
    r.reserve(h.id)
    Object.assign(h.position, w.grid.gridToWorld(r.dock))
    h.cargo = 60
    h.heading = r.heading
    h.state = 'UNLOAD'
    expect(
      sim.commands.enqueue({ type: 'HARVEST', unitId: h.id, resourceId: d.id })
        .accepted,
    ).toBe(true)
    const harvesting = () => h.state === 'HARVEST'
    for (let i = 0; i < 2500 && !harvesting(); i++) sim.step(0.05)
    expect(h.deliveries).toBe(1)
    expect(h.targetId).toBe(d.id)
    expect(h.state).toBe('HARVEST')
    expect(r.reservedBy).toBeUndefined()
  })
  it('rejects an empty return, depleted field and unreachable field without replacing current work', () => {
    const sim = new Simulation(),
      w = sim.world,
      h = w.units[0],
      d = w.deposits[0]
    advance(sim, 1)
    const state = h.state,
      target = h.targetId
    expect(
      sim.commands.enqueue({ type: 'RETURN_CARGO', unitId: h.id }),
    ).toEqual({ accepted: false, reason: 'Cargo bay is empty' })
    d.amount = 0
    expect(
      sim.commands.enqueue({ type: 'HARVEST', unitId: h.id, resourceId: d.id })
        .accepted,
    ).toBe(false)
    d.amount = 100
    for (let z = d.cell.z - 4; z <= d.cell.z + 4; z++)
      for (let x = d.cell.x - 4; x <= d.cell.x + 4; x++)
        if (Math.max(Math.abs(x - d.cell.x), Math.abs(z - d.cell.z)) === 4)
          w.grid.occupy({ x, z }, 1, 1, 'wall', 'rock')
    expect(
      sim.commands.enqueue({ type: 'HARVEST', unitId: h.id, resourceId: d.id }),
    ).toEqual({ accepted: false, reason: 'No route to deposit' })
    expect(h.state).toBe(state)
    expect(h.targetId).toBe(target)
  })
})

describe('three tank classes', () => {
  it('starts parked clear of buildings, minerals, other units and the shared dock', () => {
    const w = new World()
    expect(w.tanks.map((t) => t.tankClass)).toEqual([
      'light',
      'medium',
      'heavy',
    ])
    for (const tank of w.tanks) {
      expect(w.grid.isWalkable(w.grid.worldToGrid(tank.position))).toBe(true)
      for (const other of w.vehicles)
        if (other !== tank)
          expect(
            Math.hypot(
              tank.position.x - other.position.x,
              tank.position.z - other.position.z,
            ),
          ).toBeGreaterThan(w.settings.unitSeparation)
      for (const d of w.deposits) {
        const p = w.grid.gridToWorld(d.cell)
        expect(
          Math.hypot(tank.position.x - p.x, tank.position.z - p.z),
        ).toBeGreaterThan(d.harvestingRadius + w.settings.unitSeparation)
      }
    }
  })
  it.each(['light', 'medium', 'heavy'] as const)(
    '%s obeys MOVE and HOLD with its own speed and keeps position when idle',
    (kind) => {
      const sim = new Simulation(
          new World(undefined, [], undefined, [
            { id: `tank-${kind}`, tankClass: kind, x: 30, z: 14 },
          ]),
        ),
        w = sim.world,
        t = w.tanks[0],
        goal = { x: 36, z: 14 }
      expect(
        sim.commands.enqueue({ type: 'MOVE', unitId: t.id, destination: goal })
          .accepted,
      ).toBe(true)
      advance(sim, 30)
      expect(t.state).toBe('STOPPED')
      expect(t.position).toEqual(w.grid.gridToWorld(goal))
      const position = { ...t.position }
      advance(sim, 20)
      expect(t.position).toEqual(position)
      expect(
        sim.commands.enqueue({
          type: 'MOVE',
          unitId: t.id,
          destination: { x: 40, z: 14 },
        }).accepted,
      ).toBe(true)
      advance(sim, 1)
      sim.commands.enqueue({ type: 'STOP', unitId: t.id })
      sim.step(0.05)
      const stopped = { ...t.position }
      advance(sim, 2)
      expect(t.position).toEqual(stopped)
      expect(t.speed).toBe(0)
    },
  )
  it('scans smoothly at staggered intervals with fixed ticks, and centers the turret while moving', () => {
    const sim = new Simulation(),
      w = sim.world,
      t = w.tanks[0],
      start = { ...t.position }
    advance(sim, 2)
    expect(t.turretHeading).toBe(0)
    advance(sim, 3)
    expect(Math.abs(t.turretHeading)).toBeGreaterThan(0.2)
    expect(t.position).toEqual(start)
    const yaw = t.turretHeading
    sim.step(0.05)
    expect(Math.abs(t.turretHeading - yaw)).toBeLessThanOrEqual(
      0.65 * 0.05 + 0.00001,
    )
    expect(
      sim.commands.enqueue({
        type: 'MOVE',
        unitId: t.id,
        destination: { x: 21, z: 16 },
      }).accepted,
    ).toBe(true)
    advance(sim, 1)
    expect(t.turretTarget).toBe(0)
    expect(Math.abs(t.turretHeading)).toBeLessThan(Math.abs(yaw))
  })
  it('includes parked tanks in harvester and tank collision previews', () => {
    const sim = new Simulation(),
      w = sim.world,
      t = w.tanks[0]
    const cell = w.grid.worldToGrid(t.position)
    expect(sim.previewMove(w.units[0].id, cell).accepted).toBe(false)
    expect(sim.previewMove(w.tanks[1].id, cell).accepted).toBe(false)
  })
})
