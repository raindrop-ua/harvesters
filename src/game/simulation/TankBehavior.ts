import { config } from '../config'
import { VehicleNavigation } from '../navigation/VehicleNavigation'
import type { GridPosition, Tank, UnitCommand } from '../types'
import { angleDelta } from './HarvesterBehavior'
import type { World } from './World'

/** Movement and idle watch only. Turret yaw is independent of hull navigation. */
export class TankBehavior {
  private readonly movement: VehicleNavigation
  constructor(
    readonly world: World,
    readonly unit: Tank,
  ) {
    this.movement = new VehicleNavigation(world, unit)
  }
  canMoveTo(destination: GridPosition): boolean {
    return (
      this.movement.findPath(destination, this.movement.obstacles()) !== null
    )
  }
  private route(destination: GridPosition): boolean {
    const path = this.movement.findPath(destination, this.movement.obstacles())
    if (!path) return false
    Object.assign(this.unit, {
      path,
      pathIndex: 0,
      blockedTime: 0,
      state: 'MOVE',
      stateTime: 0,
      message: 'Following move order',
    })
    return true
  }
  execute(command: UnitCommand): void {
    if (command.type !== 'MOVE' && command.type !== 'STOP') return
    const u = this.unit
    u.path = []
    u.pathIndex = 0
    u.speed = 0
    u.state = 'STOPPED'
    u.stateTime = 0
    u.message = 'Holding position · perimeter watch'
    if (command.type === 'MOVE' && !this.route(command.destination))
      u.message = 'Destination unreachable'
  }
  step(dt: number): void {
    const w = this.world,
      u = this.unit,
      settings = config.tanks[u.tankClass]
    u.stateTime += dt
    if (u.state === 'MOVE') this.move(dt)
    // Long, staggered pauses between small deliberate scans; deterministic across frame rates.
    if (u.state === 'MOVE') {
      u.turretTarget = 0
      u.nextScanAt = w.time + 4
    } else if (w.time >= u.nextScanAt) {
      u.scanSequence++
      u.turretTarget = Math.sin(u.scanSequence * 2.399963) * 0.95
      u.nextScanAt = w.time + 5.5 + (u.scanSequence % 4) * 1.3
    }
    const turn = angleDelta(u.turretHeading, u.turretTarget)
    u.turretHeading += Math.max(
      -settings.turretSpeed * dt,
      Math.min(settings.turretSpeed * dt, turn),
    )
  }
  private move(dt: number): void {
    const w = this.world,
      u = this.unit,
      settings = config.tanks[u.tankClass]
    const next = u.path[u.pathIndex]
    if (!next) {
      u.speed = 0
      u.state = 'STOPPED'
      u.message = 'Move order complete · perimeter watch'
      return
    }
    const from = w.grid.worldToGrid(u.position)
    if (
      !w.grid.isWalkable(next) ||
      ((from.x !== next.x || from.z !== next.z) && !w.grid.canStep(from, next))
    ) {
      const goal = u.path.at(-1)!
      u.speed = 0
      if (!this.route(goal)) {
        u.state = 'STOPPED'
        u.path = []
        u.message = 'Route blocked · standing by'
      }
      return
    }
    const target = w.grid.gridToWorld(next),
      dx = target.x - u.position.x,
      dz = target.z - u.position.z
    const distance = Math.hypot(dx, dz),
      difference = angleDelta(u.heading, Math.atan2(dx, dz))
    u.heading += Math.max(
      -settings.turnSpeed * dt,
      Math.min(settings.turnSpeed * dt, difference),
    )
    const topSpeed =
      u.pathIndex === u.path.length - 1
        ? Math.min(
            settings.speed,
            Math.sqrt(2 * settings.acceleration * distance),
          )
        : settings.speed
    const desiredSpeed = topSpeed * Math.max(0.15, Math.cos(difference))
    u.speed = Math.max(
      0,
      u.speed +
        Math.max(
          -settings.acceleration * dt,
          Math.min(settings.acceleration * dt, desiredSpeed - u.speed),
        ),
    )
    const amount = Math.min(distance, u.speed * dt)
    const x = u.position.x + (distance ? (dx / distance) * amount : 0),
      z = u.position.z + (distance ? (dz / distance) * amount : 0)
    const obstruction = this.movement.obstructionAt(x, z)
    if (obstruction) {
      u.speed = 0
      u.blockedTime += dt
      u.message = `Yielding to ${obstruction.id}`
      if (u.blockedTime >= w.settings.retryInterval) {
        this.route(u.path.at(-1)!)
        u.blockedTime = 0
      }
      return
    }
    u.blockedTime = 0
    Object.assign(u.position, { x, z, y: w.grid.heightAt(x, z) })
    if (distance <= amount + 0.015) {
      Object.assign(u.position, target)
      u.pathIndex++
    }
  }
}
