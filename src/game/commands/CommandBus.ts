import type { CommandResult, UnitCommand } from '../types'

/** Commands are validated on enqueue and executed only at simulation tick boundaries. */
export class CommandBus {
  private queue: UnitCommand[] = []
  constructor(private validate: (command: UnitCommand) => CommandResult) {}
  enqueue(command: UnitCommand): CommandResult {
    if (this.queue.length >= 64)
      return { accepted: false, reason: 'Command queue is full' }
    const result = this.validate(command)
    if (result.accepted)
      this.queue.push(
        command.type === 'MOVE'
          ? { ...command, destination: { ...command.destination } }
          : { ...command },
      )
    return result
  }
  flush(execute: (command: UnitCommand) => void): void {
    for (const command of this.queue)
      if (this.validate(command).accepted) execute(command)
    this.queue.length = 0
  }
}
