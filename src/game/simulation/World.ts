import layout from '../../../assets/world.json'
import { config, type HarvesterConfig, type MineralConfig } from '../config'
import { Grid } from '../navigation/Grid'
import { Pathfinder } from '../navigation/Pathfinder'
import { Economy, Refinery } from '../economy/Economy'
import type { Deposit, Harvester, Position, ResourceReceiver } from '../types'

export { layout }

export class World {
  readonly grid: Grid
  readonly navigation: Pathfinder
  readonly economy = new Economy()
  readonly deposits: Deposit[]
  readonly units: Harvester[]
  readonly refineryPosition: Position
  refinery: ResourceReceiver | undefined
  time = 0
  deliveries = 0
  extracted = 0
  regenerated = 0

  constructor(
    readonly settings: HarvesterConfig = { ...config.harvester },
    spawns = layout.harvesters,
    readonly mineralSettings: MineralConfig = { ...config.minerals },
  ) {
    this.grid = new Grid()
    this.navigation = new Pathfinder(this.grid)
    const ref = layout.refinery
    this.refinery = new Refinery(ref, this.economy)
    this.grid.occupy(ref, ref.width, ref.depth, this.refinery.id, 'building')
    this.refineryPosition = {
      x: (ref.x + ref.width / 2) * this.grid.cellSize - this.grid.halfSize,
      z: (ref.z + ref.depth / 2) * this.grid.cellSize - this.grid.halfSize,
      y: 0.12,
    }
    for (const [index, rock] of layout.rocks.entries()) {
      // A conservative footprint includes vehicle clearance around the authored silhouette.
      const radius = rock.scale * 3.1 + 1.2
      for (const cell of this.grid.cells) {
        const p = this.grid.gridToWorld(cell)
        if (Math.hypot(p.x - rock.x, p.z - rock.z) < radius)
          this.grid.occupy(cell, 1, 1, `rock-${index}`, 'rock')
      }
    }
    this.deposits = layout.deposits.map((d) => {
      this.grid.occupy({ x: d.x - 1, z: d.z - 1 }, 3, 3, d.id, 'mineral')
      return {
        id: d.id,
        cell: { x: d.x, z: d.z },
        amount: d.amount,
        initialAmount: d.amount,
        type: 'mineral',
        harvestingRadius: settings.harvestingRadius,
        scale: d.scale,
      }
    })
    this.units = spawns.map((definition) => {
      const position = this.grid.gridToWorld(definition)
      return {
        id: definition.id,
        position,
        previousPosition: { ...position },
        heading: Math.PI,
        previousHeading: Math.PI,
        speed: 0,
        state: 'IDLE',
        stateTime: 0,
        cargo: 0,
        capacity: settings.capacity,
        resourceType: 'mineral',
        path: [],
        pathIndex: 0,
        autonomous: true,
        retryAt: 0,
        message: 'Systems online',
        blockedTime: 0,
        deliveries: 0,
      }
    })
  }
}
