import { CommandBus } from '../commands/CommandBus'
import type {
  CommandResult,
  Deposit,
  GridPosition,
  HarvesterState,
  UnitCommand,
} from '../types'
import { World } from './World'

export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/** Framework-independent, authoritative fixed-step gameplay. No rendering imports. */
export class Simulation {
  readonly commands = new CommandBus((command) => this.validateCommand(command))
  constructor(readonly world = new World()) {}

  validateCommand(command: UnitCommand): CommandResult {
    const { world } = this
    if (command.unitId !== world.unit.id)
      return { accepted: false, reason: 'Unknown unit' }
    switch (command.type) {
      case 'MOVE':
        return world.grid.isWalkable(command.destination)
          ? { accepted: true }
          : {
              accepted: false,
              reason: 'Destination is blocked or outside the map',
            }
      case 'HARVEST':
        return world.deposits.some(
          (d) => d.id === command.resourceId && d.amount > 0,
        )
          ? { accepted: true }
          : { accepted: false, reason: 'No available minerals at this deposit' }
      case 'RETURN_CARGO':
        return world.refinery
          ? { accepted: true }
          : { accepted: false, reason: 'No refinery available' }
      case 'STOP':
      case 'AUTO':
        return { accepted: true }
      default:
        return { accepted: false, reason: 'Unknown command' }
    }
  }

  private transition(state: HarvesterState, message: string): void {
    const u = this.world.unit
    u.state = state
    u.stateTime = 0
    u.message = message
  }

  private route(
    destination: GridPosition,
    state: HarvesterState,
    message: string,
  ): boolean {
    const { grid, navigation, unit } = this.world
    const path = navigation.findPath(
      grid.worldToGrid(unit.position),
      destination,
    )
    if (!path) return false
    unit.path = path
    unit.pathIndex = 0
    this.transition(state, message)
    return true
  }

  private execute(command: UnitCommand): void {
    const u = this.world.unit
    // Changing orders releases any dock reservation immediately.
    this.world.refinery?.release(u.id)
    u.path = []
    u.speed = 0
    u.targetId = undefined
    if (command.type === 'STOP') {
      u.autonomous = false
      this.transition('STOPPED', 'Standing by · cargo retained')
    } else if (command.type === 'MOVE') {
      u.autonomous = false
      if (!this.route(command.destination, 'MOVE', 'Following move order'))
        this.transition('STOPPED', 'Destination unreachable')
    } else if (command.type === 'HARVEST') {
      u.autonomous = true
      const deposit = this.world.deposits.find(
        (d) => d.id === command.resourceId,
      )
      if (!deposit || !this.routeToDeposit(deposit))
        this.wait('Deposit unreachable')
    } else {
      u.autonomous = true
      this.transition(
        command.type === 'RETURN_CARGO' && u.cargo > 0
          ? 'CARGO_FULL'
          : 'FIND_RESOURCE',
        'Autopilot engaged',
      )
      u.retryAt = 0
    }
  }

  private wait(message: string): void {
    const u = this.world.unit
    this.world.refinery?.release(u.id)
    u.path = []
    u.speed = 0
    u.retryAt = this.world.time + this.world.settings.retryInterval
    this.transition('IDLE', message)
  }

  private routeToDeposit(deposit: Deposit): boolean {
    const w = this.world,
      u = w.unit
    const radius = Math.ceil(deposit.harvestingRadius / w.grid.cellSize)
    const approaches: GridPosition[] = []
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = { x: deposit.cell.x + dx, z: deposit.cell.z + dz }
        const distance = Math.hypot(dx, dz) * w.grid.cellSize
        if (
          distance <= deposit.harvestingRadius &&
          distance >= w.settings.minimumHarvestDistance &&
          w.grid.isWalkable(cell)
        )
          approaches.push(cell)
      }
    }
    approaches.sort((a, b) => {
      const pa = w.grid.gridToWorld(a),
        pb = w.grid.gridToWorld(b)
      return (
        Math.hypot(pa.x - u.position.x, pa.z - u.position.z) -
        Math.hypot(pb.x - u.position.x, pb.z - u.position.z)
      )
    })
    for (const approach of approaches) {
      if (
        this.route(
          approach,
          'MOVE_TO_RESOURCE',
          `En route to ${deposit.id.replace('mineral-', 'field ')}`,
        )
      ) {
        u.targetId = deposit.id
        return true
      }
    }
    return false
  }

  private findResource(): void {
    const w = this.world,
      u = w.unit
    if (u.cargo >= u.capacity - 1e-8) {
      this.transition('CARGO_FULL', 'Cargo bay full')
      return
    }
    const deposits = w.deposits
      .filter((d) => d.amount > 1e-8)
      .sort((a, b) => {
        const pa = w.grid.gridToWorld(a.cell),
          pb = w.grid.gridToWorld(b.cell)
        return (
          Math.hypot(pa.x - u.position.x, pa.z - u.position.z) -
          Math.hypot(pb.x - u.position.x, pb.z - u.position.z)
        )
      })
    for (const deposit of deposits) if (this.routeToDeposit(deposit)) return
    if (u.cargo > 0) this.transition('CARGO_FULL', 'Returning remaining cargo')
    else
      this.wait(
        deposits.length
          ? 'No reachable deposits · retrying'
          : 'All deposits depleted · standing by',
      )
  }

  private returnCargo(): void {
    const w = this.world,
      u = w.unit,
      receiver = w.refinery
    if (!receiver) {
      this.wait('No refinery · cargo retained')
      return
    }
    if (!receiver.reserve(u.id)) {
      this.wait('Dock occupied · waiting')
      return
    }
    if (
      !this.route(
        receiver.dock,
        'MOVE_TO_REFINERY',
        'Returning to K-01 refinery',
      )
    )
      this.wait('Dock unreachable · cargo retained')
  }

  private move(dt: number): void {
    const w = this.world,
      u = w.unit
    if (u.state === 'MOVE_TO_REFINERY' && !w.refinery) {
      this.wait('Refinery unavailable · cargo retained')
      return
    }
    const next = u.path[u.pathIndex]
    if (!next) {
      u.speed = 0
      if (u.state === 'MOVE_TO_RESOURCE')
        this.transition('HARVEST', 'Extracting cyan minerals')
      else if (u.state === 'MOVE_TO_REFINERY')
        this.transition('DOCK', 'Aligning with unloading port')
      else this.transition('STOPPED', 'Move order complete')
      return
    }
    const from = w.grid.worldToGrid(u.position)
    if (
      !w.grid.isWalkable(next) ||
      ((from.x !== next.x || from.z !== next.z) && !w.grid.canStep(from, next))
    ) {
      const state = u.state
      u.path = []
      u.speed = 0
      if (state === 'MOVE')
        this.transition('STOPPED', 'Route blocked · order stopped')
      else if (state === 'MOVE_TO_REFINERY') {
        w.refinery?.release(u.id)
        this.wait('Return route changed · replanning')
      } else {
        this.transition('FIND_RESOURCE', 'Route changed · replanning')
      }
      return
    }
    const target = w.grid.gridToWorld(next),
      dx = target.x - u.position.x,
      dz = target.z - u.position.z
    const distance = Math.hypot(dx, dz)
    const difference = angleDelta(u.heading, Math.atan2(dx, dz))
    u.heading += Math.max(
      -w.settings.turnSpeed * dt,
      Math.min(w.settings.turnSpeed * dt, difference),
    )
    const last = u.pathIndex === u.path.length - 1
    const topSpeed = Math.min(
      w.settings.speed,
      last
        ? Math.sqrt(2 * w.settings.acceleration * distance)
        : w.settings.speed,
    )
    const desiredSpeed = topSpeed * Math.max(0.15, Math.cos(difference))
    const change = Math.max(
      -w.settings.acceleration * dt,
      Math.min(w.settings.acceleration * dt, desiredSpeed - u.speed),
    )
    u.speed = Math.max(0, u.speed + change)
    const amount = Math.min(distance, u.speed * dt)
    if (distance > 0) {
      u.position.x += (dx / distance) * amount
      u.position.z += (dz / distance) * amount
    }
    u.position.y = w.grid.heightAt(u.position.x, u.position.z)
    if (distance <= amount + 0.015) {
      Object.assign(u.position, target)
      u.pathIndex++
    }
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    const w = this.world,
      u = w.unit
    Object.assign(u.previousPosition, u.position)
    u.previousHeading = u.heading
    w.time += dt
    u.stateTime += dt
    this.commands.flush((command) => this.execute(command))
    switch (u.state) {
      case 'IDLE':
        if (u.autonomous && w.time >= u.retryAt)
          this.transition(
            u.cargo > 0 ? 'CARGO_FULL' : 'FIND_RESOURCE',
            'Scanning for resources',
          )
        break
      case 'FIND_RESOURCE':
        this.findResource()
        break
      case 'CARGO_FULL':
        this.returnCargo()
        break
      case 'MOVE':
      case 'MOVE_TO_RESOURCE':
      case 'MOVE_TO_REFINERY':
        this.move(dt)
        break
      case 'HARVEST': {
        const deposit = w.deposits.find((d) => d.id === u.targetId)
        if (!deposit || deposit.amount <= 1e-8) {
          this.transition(
            u.cargo > 0 ? 'CARGO_FULL' : 'FIND_RESOURCE',
            'Deposit depleted',
          )
          break
        }
        const p = w.grid.gridToWorld(deposit.cell)
        if (
          Math.hypot(p.x - u.position.x, p.z - u.position.z) >
          deposit.harvestingRadius + 0.1
        ) {
          this.transition('FIND_RESOURCE', 'Outside extraction range')
          break
        }
        const difference = angleDelta(
          u.heading,
          Math.atan2(p.x - u.position.x, p.z - u.position.z),
        )
        u.heading += Math.max(
          -w.settings.turnSpeed * dt,
          Math.min(w.settings.turnSpeed * dt, difference),
        )
        const amount = Math.min(
          w.settings.harvestRate * dt,
          u.capacity - u.cargo,
          deposit.amount,
        )
        deposit.amount = Math.max(0, deposit.amount - amount)
        u.cargo += amount
        w.extracted += amount
        if (deposit.amount <= 1e-8) {
          deposit.amount = 0
          w.grid.release(deposit.id)
        }
        if (u.cargo >= u.capacity - 1e-8 || deposit.amount === 0)
          this.transition(
            'CARGO_FULL',
            deposit.amount === 0
              ? 'Deposit depleted · returning cargo'
              : 'Cargo bay full',
          )
        break
      }
      case 'DOCK': {
        const receiver = w.refinery
        if (
          !receiver ||
          !w.grid.isWalkable(receiver.dock) ||
          !receiver.reserve(u.id)
        ) {
          this.wait('Dock unavailable · cargo retained')
          break
        }
        if (u.stateTime >= w.settings.dockingTime)
          this.transition('UNLOAD', 'Transferring cargo to storage')
        break
      }
      case 'UNLOAD': {
        const receiver = w.refinery
        if (
          !receiver ||
          !w.grid.isWalkable(receiver.dock) ||
          !receiver.canAccept(u.id)
        ) {
          this.wait('Transfer interrupted · cargo retained')
          break
        }
        const sent = receiver.receiveResources(
          u.resourceType,
          Math.min(u.cargo, w.settings.unloadRate * dt),
        )
        if (sent <= 0 && u.cargo > 0) {
          this.wait('Storage unavailable · cargo retained')
          break
        }
        u.cargo = Math.max(0, u.cargo - sent)
        if (u.cargo < 1e-8) {
          u.cargo = 0
          w.deliveries++
          receiver.release(u.id)
          this.transition(
            'FIND_RESOURCE',
            'Delivery complete · resuming extraction',
          )
        }
        break
      }
      case 'STOPPED':
        break
    }
  }
}
