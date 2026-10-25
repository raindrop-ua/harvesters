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

interface DockDefinition {
  dock: GridPosition
  entry: GridPosition
  exit: GridPosition
  heading: number
  waitingSlots: readonly GridPosition[]
}

/** FIFO requests retain distinct waiting slots. The owner holds the dock until it drives clear. */
export class Refinery implements ResourceReceiver {
  readonly id = 'refinery-01'
  readonly dock: GridPosition
  readonly entry: GridPosition
  readonly exit: GridPosition
  readonly heading: number
  private requests: EntityId[] = []
  private slots = new Map<EntityId, GridPosition>()
  reservedBy?: EntityId
  get queue(): readonly EntityId[] {
    return this.requests
  }

  constructor(
    private definition: DockDefinition,
    private economy: Economy,
  ) {
    this.dock = definition.dock
    this.entry = definition.entry
    this.exit = definition.exit
    this.heading = definition.heading
  }
  request(
    unitId: EntityId,
    canUse: (slot: GridPosition) => boolean = () => true,
  ): GridPosition | undefined {
    const existing = this.slots.get(unitId)
    if (existing) return existing
    const free = this.definition.waitingSlots.find(
      (slot) => ![...this.slots.values()].includes(slot) && canUse(slot),
    )
    if (!free) return undefined
    this.slots.set(unitId, free)
    this.requests.push(unitId)
    return free
  }
  queuePosition(unitId: EntityId): number {
    return this.requests.indexOf(unitId) + 1
  }
  canAccept(unitId: EntityId): boolean {
    return (
      this.reservedBy === unitId ||
      (!this.reservedBy && this.requests[0] === unitId)
    )
  }
  reserve(unitId: EntityId): boolean {
    if (!this.canAccept(unitId)) return false
    this.reservedBy = unitId
    return true
  }
  release(unitId: EntityId): void {
    if (this.reservedBy === unitId) this.reservedBy = undefined
    this.requests = this.requests.filter((id) => id !== unitId)
    this.slots.delete(unitId)
  }
  receiveResources(
    unitId: EntityId,
    type: ResourceType,
    amount: number,
  ): number {
    return this.reservedBy === unitId ? this.economy.deposit(type, amount) : 0
  }
}
