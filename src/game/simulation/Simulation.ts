import { CommandBus } from '../commands/CommandBus'
import type { CommandResult, UnitCommand } from '../types'
import { HarvesterBehavior } from './HarvesterBehavior'
import { World } from './World'

export { angleDelta } from './HarvesterBehavior'

/** Owns tick ordering; each unit has independent behavior and a shared receiver/economy. */
export class Simulation {
  readonly commands = new CommandBus((command) => this.validateCommand(command))
  private readonly behaviors: HarvesterBehavior[]
  constructor(readonly world = new World()) {
    this.behaviors = world.units.map(
      (unit) => new HarvesterBehavior(world, unit),
    )
  }
  validateCommand(command: UnitCommand): CommandResult {
    if (!this.world.units.some((u) => u.id === command.unitId))
      return { accepted: false, reason: 'Unknown unit' }
    switch (command.type) {
      case 'MOVE':
        return this.world.grid.isWalkable(command.destination)
          ? { accepted: true }
          : {
              accepted: false,
              reason: 'Destination is blocked or outside the map',
            }
      case 'HARVEST':
        return this.world.deposits.some(
          (d) => d.id === command.resourceId && d.amount > 0,
        )
          ? { accepted: true }
          : { accepted: false, reason: 'No available minerals at this deposit' }
      case 'RETURN_CARGO':
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
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    for (const u of this.world.units) {
      Object.assign(u.previousPosition, u.position)
      u.previousHeading = u.heading
    }
    this.world.time += dt
    this.commands.flush((command) =>
      this.behaviors
        .find((b) => b.unit.id === command.unitId)
        ?.execute(command),
    )
    for (const behavior of this.behaviors) behavior.step(dt)
  }
}
