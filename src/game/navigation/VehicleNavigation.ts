import type { GridPosition, MobileUnit } from '../types'
import type { World } from '../simulation/World'

/** Shared clearance rules for every mobile unit, including the reserved dock approach. */
export class VehicleNavigation {
  constructor(
    readonly world: World,
    readonly unit: MobileUnit,
  ) {}
  obstacles(): Set<number> {
    const w = this.world,
      blocked = new Set<number>(),
      receiver = w.refinery
    for (const cell of w.grid.cells) {
      const p = w.grid.gridToWorld(cell)
      if (
        w.vehicles.some(
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
  findPath(destination: GridPosition, blocked: Set<number>) {
    return this.world.navigation.findPath(
      this.world.grid.worldToGrid(this.unit.position),
      destination,
      blocked,
      (next) => this.canConnect(next),
    )
  }
  private canConnect(next: GridPosition): boolean {
    const w = this.world,
      u = this.unit,
      to = w.grid.gridToWorld(next)
    const dx = to.x - u.position.x,
      dz = to.z - u.position.z,
      length2 = dx * dx + dz * dz
    return w.vehicles.every((other) => {
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
  obstructionAt(x: number, z: number) {
    const u = this.unit
    return this.world.vehicles.find(
      (other) =>
        other !== u &&
        Math.hypot(other.position.x - x, other.position.z - z) <
          this.world.settings.unitSeparation &&
        Math.hypot(other.position.x - x, other.position.z - z) <
          Math.hypot(
            other.position.x - u.position.x,
            other.position.z - u.position.z,
          ),
    )
  }
}
