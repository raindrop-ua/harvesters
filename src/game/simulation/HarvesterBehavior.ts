import type {
  Deposit,
  GridPosition,
  Harvester,
  HarvesterState,
  ResourceReceiver,
  UnitCommand,
} from '../types'
import type { World } from './World'

export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

const dockStates: readonly HarvesterState[] = [
  'MOVE_TO_REFINERY',
  'DOCK',
  'UNLOAD',
  'UNDOCK',
  'LEAVE_REFINERY',
]

/** One unit's behavior; all fleet members share navigation, finite deposits, and the dock. */
export class HarvesterBehavior {
  constructor(
    readonly world: World,
    readonly unit: Harvester,
  ) {}

  private transition(state: HarvesterState, message: string): void {
    Object.assign(this.unit, { state, stateTime: 0, message })
  }
  private obstacles(): Set<number> {
    const w = this.world,
      blocked = new Set<number>(),
      receiver = w.refinery
    for (const cell of w.grid.cells) {
      const p = w.grid.gridToWorld(cell)
      if (
        w.units.some(
          (other) =>
            other !== this.unit &&
            Math.hypot(p.x - other.position.x, p.z - other.position.z) <
              w.settings.unitSeparation,
        )
      )
        blocked.add(cell.z * w.grid.width + cell.x)
      if (receiver?.reservedBy && receiver.reservedBy !== this.unit.id) {
        const dock = w.grid.gridToWorld(receiver.dock),
          entry = w.grid.gridToWorld(receiver.entry)
        if (
          Math.abs(p.x - dock.x) < 3 &&
          p.z >= dock.z - 2 &&
          p.z <= entry.z + 2
        )
          blocked.add(cell.z * w.grid.width + cell.x)
      }
    }
    return blocked
  }
  private route(
    destination: GridPosition,
    state: HarvesterState,
    message: string,
    via?: GridPosition,
  ): boolean {
    const w = this.world,
      u = this.unit,
      blocked = this.obstacles()
    const start = w.grid.worldToGrid(u.position)
    const first = w.navigation.findPath(
      start,
      via ?? destination,
      blocked,
      (next) => this.canConnect(next),
    )
    if (!first) return false
    const second = via ? w.navigation.findPath(via, destination, blocked) : []
    if (!second) return false
    u.path = first.concat(second)
    u.pathIndex = 0
    u.blockedTime = 0
    u.retryAt = 0
    this.transition(state, message)
    return true
  }
  private canConnect(next: GridPosition): boolean {
    const w = this.world,
      u = this.unit,
      to = w.grid.gridToWorld(next)
    const dx = to.x - u.position.x,
      dz = to.z - u.position.z,
      length2 = dx * dx + dz * dz
    return w.units.every((other) => {
      if (other === u) return true
      const ox = other.position.x - u.position.x,
        oz = other.position.z - u.position.z
      const t = length2
        ? Math.max(0, Math.min(1, (ox * dx + oz * dz) / length2))
        : 0
      const minimum = Math.hypot(ox - t * dx, oz - t * dz)
      return (
        minimum >=
        Math.min(w.settings.unitSeparation, Math.hypot(ox, oz)) - 0.0001
      )
    })
  }
  private insidePort(receiver: ResourceReceiver): boolean {
    const dock = this.world.grid.gridToWorld(receiver.dock)
    return (
      Math.hypot(this.unit.position.x - dock.x, this.unit.position.z - dock.z) <
      7.5
    )
  }
  execute(command: UnitCommand): void {
    const u = this.unit,
      receiver = this.world.refinery
    // A vehicle held inside the port must retain the physical dock lock.
    if (
      receiver &&
      (receiver.reservedBy !== u.id || !this.insidePort(receiver))
    )
      receiver.release(u.id)
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
    } else if (receiver?.reservedBy === u.id) {
      u.autonomous = true
      if (u.cargo > 0) {
        const p = this.world.grid.gridToWorld(receiver.dock)
        if (
          Math.hypot(u.position.x - p.x, u.position.z - p.z) <=
          this.world.settings.dockingPositionTolerance
        )
          this.transition('DOCK', 'Resuming docking alignment')
        else if (
          !this.route(
            receiver.dock,
            'MOVE_TO_REFINERY',
            'Returning to unloading position',
            receiver.entry,
          )
        )
          this.wait('Dock unreachable · cargo retained')
      } else this.beginUndock()
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
        u.cargo > 0 ? 'CARGO_FULL' : 'FIND_RESOURCE',
        'Autopilot engaged',
      )
      u.retryAt = 0
    }
  }
  private wait(message: string): void {
    const u = this.unit
    this.world.refinery?.release(u.id)
    u.path = []
    u.speed = 0
    u.retryAt = this.world.time + this.world.settings.retryInterval
    this.transition('IDLE', message)
  }
  private routeToDeposit(deposit: Deposit): boolean {
    const w = this.world,
      u = this.unit,
      radius = Math.ceil(deposit.harvestingRadius / w.grid.cellSize)
    const approaches: GridPosition[] = []
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = { x: deposit.cell.x + dx, z: deposit.cell.z + dz },
          distance = Math.hypot(dx, dz) * w.grid.cellSize
        if (
          distance > deposit.harvestingRadius ||
          distance < w.settings.minimumHarvestDistance ||
          !w.grid.isWalkable(cell)
        )
          continue
        const p = w.grid.gridToWorld(cell)
        const claimed = w.units.some((other) => {
          if (other === u || other.targetId !== deposit.id) return false
          const endpoint = other.path.at(-1)
          const location = endpoint
            ? w.grid.gridToWorld(endpoint)
            : other.position
          return (
            Math.hypot(location.x - p.x, location.z - p.z) <
            w.settings.unitSeparation
          )
        })
        if (!claimed) approaches.push(cell)
      }
    approaches.sort((a, b) => {
      const pa = w.grid.gridToWorld(a),
        pb = w.grid.gridToWorld(b)
      return (
        Math.hypot(pa.x - u.position.x, pa.z - u.position.z) -
        Math.hypot(pb.x - u.position.x, pb.z - u.position.z)
      )
    })
    for (const approach of approaches)
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
    return false
  }
  private findResource(): void {
    const w = this.world,
      u = this.unit
    if (u.cargo >= u.capacity - 1e-8) {
      this.transition('CARGO_FULL', 'Cargo bay full')
      return
    }
    const score = (d: Deposit) => {
      const p = w.grid.gridToWorld(d.cell)
      const assigned = w.units.some(
        (other) =>
          other !== u &&
          other.targetId === d.id &&
          ['MOVE_TO_RESOURCE', 'HARVEST'].includes(other.state),
      )
      return (
        Math.hypot(p.x - u.position.x, p.z - u.position.z) +
        (assigned ? w.settings.busyDepositPenalty : 0)
      )
    }
    const deposits = w.deposits
      .filter((d) => d.amount > 1e-8)
      .sort((a, b) => score(a) - score(b))
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
      u = this.unit,
      receiver = w.refinery
    if (!receiver) {
      this.wait('No refinery · cargo retained')
      return
    }
    const slot = receiver.request(u.id, (cell) => {
      const p = w.grid.gridToWorld(cell)
      return (
        w.grid.isWalkable(cell) &&
        w.units.every(
          (other) =>
            other === u ||
            Math.hypot(other.position.x - p.x, other.position.z - p.z) >=
              w.settings.unitSeparation,
        )
      )
    })
    if (!slot) {
      this.wait('Waiting area full · retrying')
      return
    }
    if (!w.grid.isWalkable(receiver.dock)) {
      this.wait('Dock unreachable · cargo retained')
      return
    }
    if (!this.route(slot, 'MOVE_TO_QUEUE', 'Approaching refinery waiting bay'))
      this.wait('Waiting bay unreachable · retrying')
  }
  private claimDock(): void {
    const u = this.unit,
      receiver = this.world.refinery
    if (!receiver) {
      this.wait('No refinery · cargo retained')
      return
    }
    const place = receiver.queuePosition(u.id)
    if (!place) {
      this.transition('CARGO_FULL', 'Rejoining refinery queue')
      return
    }
    u.message = `Waiting for K-01 · queue ${place}`
    if (!receiver.reserve(u.id)) return
    if (
      !this.route(
        receiver.dock,
        'MOVE_TO_REFINERY',
        'Dock reserved · approaching nose first',
        receiver.entry,
      )
    )
      this.wait('Dock unreachable · cargo retained')
  }
  private beginUndock(): void {
    const receiver = this.world.refinery
    if (!receiver) {
      this.wait('Refinery unavailable')
      return
    }
    if (
      !this.route(
        receiver.entry,
        'UNDOCK',
        'Reversing out · dock still reserved',
      )
    ) {
      this.unit.retryAt = this.world.time + this.world.settings.retryInterval
      this.transition('UNDOCK', 'Exit obstructed · waiting')
    }
  }
  private leavePort(): void {
    const receiver = this.world.refinery
    if (!receiver) {
      this.wait('Refinery unavailable')
      return
    }
    // Either side of the apron can clear the port, even if another unit parks at the primary exit.
    const exits = [
      receiver.exit,
      { x: 2 * receiver.entry.x - receiver.exit.x, z: receiver.exit.z },
    ]
    for (const exit of exits)
      if (this.route(exit, 'LEAVE_REFINERY', 'Clearing the shared approach'))
        return
    this.unit.path = []
    this.unit.retryAt = this.world.time + this.world.settings.retryInterval
    this.transition('LEAVE_REFINERY', 'Exit obstructed · waiting')
  }
  private arrive(): void {
    const u = this.unit,
      receiver = this.world.refinery
    u.speed = 0
    switch (u.state) {
      case 'MOVE_TO_RESOURCE':
        this.transition('HARVEST', 'Extracting cyan minerals')
        break
      case 'MOVE_TO_QUEUE':
        this.transition('WAIT_FOR_DOCK', 'Waiting for K-01')
        break
      case 'MOVE_TO_REFINERY':
        this.transition('DOCK', 'Aligning nose with unloading port')
        break
      case 'UNDOCK':
        this.leavePort()
        break
      case 'LEAVE_REFINERY':
        receiver?.release(u.id)
        this.transition('FIND_RESOURCE', 'Dock released · resuming extraction')
        break
      default:
        this.transition('STOPPED', 'Move order complete')
    }
  }
  private move(dt: number): void {
    const w = this.world,
      u = this.unit,
      receiver = w.refinery
    if (dockStates.includes(u.state) && !receiver) {
      this.wait('Refinery unavailable · cargo retained')
      return
    }
    const next = u.path[u.pathIndex]
    if (!next) {
      if (
        (u.state === 'UNDOCK' || u.state === 'LEAVE_REFINERY') &&
        u.retryAt > 0 &&
        receiver
      ) {
        if (w.time >= u.retryAt) {
          const state = u.state
          if (state === 'LEAVE_REFINERY') this.leavePort()
          else this.beginUndock()
        }
      } else this.arrive()
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
      else if (state === 'UNDOCK' || state === 'LEAVE_REFINERY') {
        u.retryAt = w.time + w.settings.retryInterval
        this.transition(state, 'Exit obstructed · waiting')
      } else if (state === 'MOVE_TO_RESOURCE')
        this.transition('FIND_RESOURCE', 'Route changed · replanning')
      else this.wait('Return route changed · replanning')
      return
    }
    const target = w.grid.gridToWorld(next),
      dx = target.x - u.position.x,
      dz = target.z - u.position.z
    const distance = Math.hypot(dx, dz)
    const desiredHeading =
      u.state === 'UNDOCK' && receiver ? receiver.heading : Math.atan2(dx, dz)
    const difference = angleDelta(u.heading, desiredHeading)
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
    u.speed = Math.max(
      0,
      u.speed +
        Math.max(
          -w.settings.acceleration * dt,
          Math.min(w.settings.acceleration * dt, desiredSpeed - u.speed),
        ),
    )
    const amount = Math.min(distance, u.speed * dt),
      x = u.position.x + (distance ? (dx / distance) * amount : 0),
      z = u.position.z + (distance ? (dz / distance) * amount : 0)
    const obstruction = w.units.find(
      (other) =>
        other !== u &&
        Math.hypot(other.position.x - x, other.position.z - z) <
          w.settings.unitSeparation &&
        Math.hypot(other.position.x - x, other.position.z - z) <
          Math.hypot(
            other.position.x - u.position.x,
            other.position.z - u.position.z,
          ),
    )
    if (obstruction) {
      u.speed = 0
      u.blockedTime += dt
      u.message = `Yielding to ${obstruction.id.replace('harvester-', 'H-')}`
      if (u.blockedTime >= w.settings.retryInterval) {
        const goal = u.path.at(-1)!,
          state = u.state
        this.route(goal, state, 'Route adjusted around nearby unit')
        u.blockedTime = 0
      }
      return
    }
    u.blockedTime = 0
    u.position.x = x
    u.position.z = z
    u.position.y = w.grid.heightAt(x, z)
    if (distance <= amount + 0.015) {
      Object.assign(u.position, target)
      u.pathIndex++
    }
  }
  private aligned(receiver: ResourceReceiver): boolean {
    const w = this.world,
      u = this.unit,
      p = w.grid.gridToWorld(receiver.dock)
    return (
      receiver.reservedBy === u.id &&
      w.grid.isWalkable(receiver.dock) &&
      u.speed < 0.01 &&
      Math.hypot(u.position.x - p.x, u.position.z - p.z) <=
        w.settings.dockingPositionTolerance &&
      Math.abs(angleDelta(u.heading, receiver.heading)) <=
        w.settings.dockingAngleTolerance
    )
  }
  step(dt: number): void {
    const w = this.world,
      u = this.unit
    u.stateTime += dt
    const receiver = w.refinery
    // Manual orders may leave the port, but never free it while still physically inside.
    if (
      receiver?.reservedBy === u.id &&
      !dockStates.includes(u.state) &&
      !this.insidePort(receiver)
    )
      receiver.release(u.id)
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
      case 'WAIT_FOR_DOCK':
        this.claimDock()
        break
      case 'MOVE':
      case 'MOVE_TO_RESOURCE':
      case 'MOVE_TO_QUEUE':
      case 'MOVE_TO_REFINERY':
      case 'UNDOCK':
      case 'LEAVE_REFINERY':
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
        if (
          !receiver ||
          receiver.reservedBy !== u.id ||
          !w.grid.isWalkable(receiver.dock)
        ) {
          this.wait('Dock unavailable · cargo retained')
          break
        }
        const p = w.grid.gridToWorld(receiver.dock)
        if (
          Math.hypot(u.position.x - p.x, u.position.z - p.z) >
          w.settings.dockingPositionTolerance
        ) {
          this.returnCargo()
          break
        }
        const difference = angleDelta(u.heading, receiver.heading)
        u.heading += Math.max(
          -w.settings.turnSpeed * dt,
          Math.min(w.settings.turnSpeed * dt, difference),
        )
        if (!this.aligned(receiver)) u.stateTime = 0
        else if (u.stateTime >= w.settings.dockingTime)
          this.transition('UNLOAD', 'Nose aligned · transferring cargo')
        break
      }
      case 'UNLOAD': {
        if (
          !receiver ||
          receiver.reservedBy !== u.id ||
          !w.grid.isWalkable(receiver.dock)
        ) {
          this.wait('Transfer interrupted · cargo retained')
          break
        }
        if (!this.aligned(receiver)) {
          this.transition('DOCK', 'Realigning before transfer')
          break
        }
        const sent = receiver.receiveResources(
          u.id,
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
          u.deliveries++
          this.beginUndock()
        }
        break
      }
      case 'STOPPED':
        break
    }
  }
}
