import type {
  EntityId,
  GridPosition,
  ResourceReceiver,
  ResourceType,
} from '../types'

export class Economy {
  readonly balances: Record<ResourceType, number> = { mineral: 0 }
  deposit(type: ResourceType, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0
    this.balances[type] += amount
    return amount
  }
}

export class Refinery implements ResourceReceiver {
  readonly id = 'refinery-01'
  reservedBy?: EntityId
  constructor(
    readonly dock: GridPosition,
    private economy: Economy,
  ) {}
  canAccept(unitId: EntityId): boolean {
    return !this.reservedBy || this.reservedBy === unitId
  }
  reserve(unitId: EntityId): boolean {
    if (!this.canAccept(unitId)) return false
    this.reservedBy = unitId
    return true
  }
  release(unitId: EntityId): void {
    if (this.reservedBy === unitId) this.reservedBy = undefined
  }
  receiveResources(type: ResourceType, amount: number): number {
    return this.economy.deposit(type, amount)
  }
}
