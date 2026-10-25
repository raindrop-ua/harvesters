import type { Deposit } from '../types'
import type { World } from './World'

export function isRegenerating(world: World, deposit: Deposit): boolean {
  return (
    world.mineralSettings.regenerationRate > 0 &&
    deposit.amount < deposit.initialAmount &&
    !world.units.some(
      (unit) => unit.state === 'HARVEST' && unit.targetId === deposit.id,
    )
  )
}

/** Resting fields slowly recover, bounded by their authored capacity. Tick time only. */
export function regenerateMinerals(world: World, dt: number): void {
  for (const deposit of world.deposits) {
    if (!isRegenerating(world, deposit)) continue
    const before = deposit.amount
    deposit.amount = Math.min(
      deposit.initialAmount,
      before + world.mineralSettings.regenerationRate * dt,
    )
    world.regenerated += deposit.amount - before
  }
}
