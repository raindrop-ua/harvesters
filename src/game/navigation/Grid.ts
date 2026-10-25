import terrain from '../data/terrain.json'
import type { EntityId, GridPosition, Position } from '../types'

export interface GridCell extends GridPosition {
  height: number
  walkable: boolean
  buildable: boolean
  terrainType: 'sand' | 'rock' | 'building' | 'mineral'
  movementCost: number
  occupiedBy?: EntityId
}

export class Grid {
  readonly cells: GridCell[]
  readonly halfSize: number
  private occupancy = new Map<
    GridCell,
    Map<EntityId, GridCell['terrainType']>
  >()
  private unoccupied = new Map<
    GridCell,
    Pick<GridCell, 'walkable' | 'buildable' | 'terrainType'>
  >()
  revision = 0

  constructor(
    readonly width = terrain.width,
    readonly cellSize = terrain.cellSize,
    readonly heights: readonly number[] = terrain.heights,
  ) {
    this.halfSize = (width * cellSize) / 2
    this.cells = Array.from({ length: width * width }, (_, i) => {
      const x = i % width,
        z = Math.floor(i / width)
      const wx = (x + 0.5) * cellSize - this.halfSize
      const wz = (z + 0.5) * cellSize - this.halfSize
      const slope = Math.hypot(
        this.heightAt(wx + 0.5, wz) - this.heightAt(wx - 0.5, wz),
        this.heightAt(wx, wz + 0.5) - this.heightAt(wx, wz - 0.5),
      )
      return {
        x,
        z,
        height: this.heightAt(wx, wz),
        walkable: slope < 0.8,
        buildable: slope < 0.12,
        terrainType: 'sand',
        movementCost: 1 + slope * 2,
      }
    })
  }

  contains(p: GridPosition): boolean {
    return (
      Number.isInteger(p.x) &&
      Number.isInteger(p.z) &&
      p.x >= 0 &&
      p.z >= 0 &&
      p.x < this.width &&
      p.z < this.width
    )
  }

  get(p: GridPosition): GridCell | undefined {
    return this.contains(p) ? this.cells[p.z * this.width + p.x] : undefined
  }

  isWalkable(p: GridPosition): boolean {
    return this.get(p)?.walkable === true
  }

  worldToGrid(p: GridPosition): GridPosition {
    return {
      x: Math.floor((p.x + this.halfSize) / this.cellSize),
      z: Math.floor((p.z + this.halfSize) / this.cellSize),
    }
  }

  gridToWorld(p: GridPosition): Position {
    const x = (p.x + 0.5) * this.cellSize - this.halfSize
    const z = (p.z + 0.5) * this.cellSize - this.halfSize
    return { x, y: this.heightAt(x, z), z }
  }

  /** Exact barycentric sampling of the same a-c-b / b-c-d triangles exported by Blender. */
  heightAt(x: number, z: number): number {
    const gx = Math.max(
      0,
      Math.min(this.width - 0.000001, (x + this.halfSize) / this.cellSize),
    )
    const gz = Math.max(
      0,
      Math.min(this.width - 0.000001, (z + this.halfSize) / this.cellSize),
    )
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      u = gx - ix,
      v = gz - iz
    const a = iz * (this.width + 1) + ix
    const h00 = this.heights[a] ?? 0,
      h10 = this.heights[a + 1] ?? 0
    const h01 = this.heights[a + this.width + 1] ?? 0,
      h11 = this.heights[a + this.width + 2] ?? 0
    return u + v <= 1
      ? h00 + (h10 - h00) * u + (h01 - h00) * v
      : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
  }

  occupy(
    origin: GridPosition,
    width: number,
    depth: number,
    entityId: EntityId,
    terrainType: GridCell['terrainType'],
  ): void {
    for (let z = origin.z; z < origin.z + depth; z++) {
      for (let x = origin.x; x < origin.x + width; x++) {
        const cell = this.get({ x, z })
        if (!cell) continue
        if (!this.occupancy.has(cell)) {
          this.occupancy.set(cell, new Map())
          this.unoccupied.set(cell, {
            walkable: cell.walkable,
            buildable: cell.buildable,
            terrainType: cell.terrainType,
          })
        }
        this.occupancy.get(cell)!.set(entityId, terrainType)
        Object.assign(cell, {
          walkable: false,
          buildable: false,
          occupiedBy: entityId,
          terrainType,
        })
      }
    }
    this.revision++
  }

  release(entityId: EntityId): void {
    for (const [cell, occupants] of this.occupancy) {
      if (!occupants.delete(entityId)) continue
      const remaining = Array.from(occupants).at(-1)
      if (remaining) {
        cell.occupiedBy = remaining[0]
        cell.terrainType = remaining[1]
      } else {
        Object.assign(cell, this.unoccupied.get(cell))
        delete cell.occupiedBy
        this.occupancy.delete(cell)
        this.unoccupied.delete(cell)
      }
    }
    this.revision++
  }

  canStep(from: GridPosition, to: GridPosition, diagonal = true): boolean {
    if (!this.isWalkable(to)) return false
    const dx = Math.abs(to.x - from.x),
      dz = Math.abs(to.z - from.z)
    if (dx > 1 || dz > 1 || dx + dz === 0 || (!diagonal && dx + dz > 1))
      return false
    // Prevent crossing the corner of a building or rock.
    return (
      dx === 0 ||
      dz === 0 ||
      (this.isWalkable({ x: from.x, z: to.z }) &&
        this.isWalkable({ x: to.x, z: from.z }))
    )
  }
}
