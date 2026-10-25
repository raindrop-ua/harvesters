export type EntityId = string
export type ResourceType = 'mineral'
export interface GridPosition {
  x: number
  z: number
}
export interface Position extends GridPosition {
  y: number
}
export type HarvesterState =
  | 'IDLE'
  | 'FIND_RESOURCE'
  | 'MOVE_TO_RESOURCE'
  | 'HARVEST'
  | 'CARGO_FULL'
  | 'MOVE_TO_QUEUE'
  | 'WAIT_FOR_DOCK'
  | 'MOVE_TO_REFINERY'
  | 'DOCK'
  | 'UNLOAD'
  | 'UNDOCK'
  | 'LEAVE_REFINERY'
  | 'MOVE'
  | 'STOPPED'

export interface Harvester {
  id: EntityId
  position: Position
  previousPosition: Position
  heading: number
  previousHeading: number
  speed: number
  state: HarvesterState
  stateTime: number
  cargo: number
  capacity: number
  resourceType: ResourceType
  targetId?: EntityId
  path: GridPosition[]
  pathIndex: number
  autonomous: boolean
  retryAt: number
  message: string
  blockedTime: number
  deliveries: number
}

export interface Deposit {
  id: EntityId
  cell: GridPosition
  amount: number
  initialAmount: number
  type: ResourceType
  harvestingRadius: number
  scale: number
}

export interface ResourceReceiver {
  id: EntityId
  dock: GridPosition
  entry: GridPosition
  exit: GridPosition
  heading: number
  queue: readonly EntityId[]
  reservedBy?: EntityId
  request(
    unitId: EntityId,
    canUse?: (slot: GridPosition) => boolean,
  ): GridPosition | undefined
  queuePosition(unitId: EntityId): number
  canAccept(unitId: EntityId): boolean
  reserve(unitId: EntityId): boolean
  release(unitId: EntityId): void
  receiveResources(unitId: EntityId, type: ResourceType, amount: number): number
}

export type UnitCommand =
  | { type: 'MOVE'; unitId: EntityId; destination: GridPosition }
  | { type: 'HARVEST'; unitId: EntityId; resourceId: EntityId }
  | { type: 'RETURN_CARGO' | 'STOP' | 'AUTO'; unitId: EntityId }

export interface CommandResult {
  accepted: boolean
  reason?: string
}
