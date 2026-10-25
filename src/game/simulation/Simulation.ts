import { CommandBus } from '../commands/CommandBus'
import type {
  CommandResult,
  EntityId,
  GridPosition,
  UnitCommand,
  MapTarget,
} from '../types'
import { HarvesterBehavior } from './HarvesterBehavior'
import { World } from './World'
import { regenerateMinerals } from './MineralRegeneration'
import { TankBehavior } from './TankBehavior'

export { angleDelta } from './HarvesterBehavior'

/** Owns tick ordering; each unit has independent behavior and a shared receiver/economy. */
export class Simulation {
  readonly commands = new CommandBus((command) => this.validateCommand(command))
  private readonly behaviors: (HarvesterBehavior | TankBehavior)[]
  constructor(readonly world = new World()) {
    this.behaviors = [
      ...world.units.map((unit) => new HarvesterBehavior(world, unit)),
      ...world.tanks.map((unit) => new TankBehavior(world, unit)),
    ]
  }
  validateCommand(command: UnitCommand): CommandResult {
    const unit = this.world.vehicles.find((u) => u.id === command.unitId)
    if (!unit) return { accepted: false, reason: 'Unknown unit' }
    if (
      unit.kind === 'tank' &&
      command.type !== 'MOVE' &&
      command.type !== 'STOP'
    )
      return { accepted: false, reason: 'Tanks cannot harvest or unload' }
    switch (command.type) {
      case 'MOVE':
        return this.previewMove(command.unitId, command.destination)
      case 'HARVEST': {
        const deposit = this.world.deposits.find(
          (d) => d.id === command.resourceId && d.amount > 1e-8,
        )
        if (!deposit)
          return { accepted: false, reason: 'Waiting for minerals to regrow' }
        const behavior = this.behaviors.find(
          (b) => b.unit.id === command.unitId,
        )
        return behavior instanceof HarvesterBehavior &&
          behavior.canHarvest(deposit)
          ? { accepted: true }
          : { accepted: false, reason: 'No route to deposit' }
      }
      case 'RETURN_CARGO':
        if (unit.kind !== 'harvester' || unit.cargo <= 1e-8)
          return { accepted: false, reason: 'Cargo bay is empty' }
        return this.world.refinery
          ? { accepted: true }
          : { accepted: false, reason: 'No refinery available' }
      case 'STOP':
      case 'AUTO':
        return { accepted: true }
      default:
        return { accepted: false, reason: 'Unknown command' }
    }
  }
  /** Resolve a visible map target into a capability-specific order. */
  mapOrder(unitId: EntityId, target: MapTarget): UnitCommand | null {
    const unit = this.world.vehicles.find((u) => u.id === unitId)
    if (!unit) return null
    if (target.kind === 'deposit' && unit.kind === 'harvester')
      return { type: 'HARVEST', unitId, resourceId: target.id }
    if (
      target.kind === 'refinery' &&
      unit.kind === 'harvester' &&
      target.id === this.world.refinery?.id
    )
      return { type: 'RETURN_CARGO', unitId }
    if (target.kind === 'ground')
      return { type: 'MOVE', unitId, destination: target.cell }
    return null
  }
  previewMapOrder(unitId: EntityId, target: MapTarget): CommandResult {
    const command = this.mapOrder(unitId, target)
    return command
      ? this.validateCommand(command)
      : { accepted: false, reason: 'Destination blocked' }
  }
  /** Read-only query shared by hover feedback and command validation. */
  previewMove(unitId: EntityId, destination: GridPosition): CommandResult {
    const behavior = this.behaviors.find((b) => b.unit.id === unitId)
    if (!behavior) return { accepted: false, reason: 'No unit selected' }
    if (!this.world.grid.isWalkable(destination))
      return { accepted: false, reason: 'Destination blocked' }
    return behavior.canMoveTo(destination)
      ? { accepted: true }
      : { accepted: false, reason: 'No route to destination' }
  }
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    for (const u of this.world.vehicles) {
      Object.assign(u.previousPosition, u.position)
      u.previousHeading = u.heading
      if (u.kind === 'tank') u.previousTurretHeading = u.turretHeading
    }
    this.world.time += dt
    this.commands.flush((command) =>
      this.behaviors
        .find((b) => b.unit.id === command.unitId)
        ?.execute(command),
    )
    regenerateMinerals(this.world, dt)
    for (const behavior of this.behaviors) behavior.step(dt)
  }
}
