import type { GridPosition } from '../types'
import type { Grid } from './Grid'

interface Node {
  index: number
  cost: number
  score: number
  order: number
}
/** Binary min-heap with stable, deterministic tie-breaking. */
class Frontier {
  private nodes: Node[] = []
  private less(a: Node, b: Node) {
    return a.score < b.score || (a.score === b.score && a.order < b.order)
  }
  push(node: Node): void {
    const nodes = this.nodes
    nodes.push(node)
    let i = nodes.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!this.less(nodes[i], nodes[parent])) break
      ;[nodes[i], nodes[parent]] = [nodes[parent], nodes[i]]
      i = parent
    }
  }
  pop(): Node | undefined {
    const top = this.nodes[0],
      tail = this.nodes.pop()
    if (this.nodes.length && tail) {
      this.nodes[0] = tail
      let i = 0
      while (true) {
        const left = i * 2 + 1,
          right = left + 1
        let best = i
        if (
          left < this.nodes.length &&
          this.less(this.nodes[left], this.nodes[best])
        )
          best = left
        if (
          right < this.nodes.length &&
          this.less(this.nodes[right], this.nodes[best])
        )
          best = right
        if (best === i) break
        ;[this.nodes[i], this.nodes[best]] = [this.nodes[best], this.nodes[i]]
        i = best
      }
    }
    return top
  }
}

export interface NavigationService {
  findPath(start: GridPosition, goal: GridPosition): GridPosition[] | null
}

export class Pathfinder implements NavigationService {
  constructor(
    readonly grid: Grid,
    readonly diagonal = true,
  ) {}

  findPath(start: GridPosition, goal: GridPosition): GridPosition[] | null {
    const grid = this.grid
    if (!grid.isWalkable(start) || !grid.isWalkable(goal)) return null
    const width = grid.width,
      size = width * width
    const key = (p: GridPosition) => p.z * width + p.x
    const end = key(goal),
      first = key(start)
    if (first === end) return []
    const costs = new Float64Array(size).fill(Infinity)
    const previous = new Int32Array(size).fill(-1)
    const frontier = new Frontier()
    let order = 0
    costs[first] = 0
    frontier.push({ index: first, cost: 0, score: 0, order: order++ })
    const directions = this.diagonal
      ? [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
          [1, -1],
          [1, 1],
          [-1, 1],
          [-1, -1],
        ]
      : [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]
    let node: Node | undefined
    while ((node = frontier.pop())) {
      if (node.cost > costs[node.index]) continue
      if (node.index === end) {
        const path: GridPosition[] = []
        for (let i = end; i !== first; i = previous[i])
          path.push({ x: i % width, z: Math.floor(i / width) })
        return path.reverse()
      }
      const from = { x: node.index % width, z: Math.floor(node.index / width) }
      for (const [dx, dz] of directions) {
        const next = { x: from.x + dx, z: from.z + dz }
        if (!grid.canStep(from, next, this.diagonal)) continue
        const index = key(next),
          cell = grid.cells[index]
        const cost = node.cost + (dx && dz ? Math.SQRT2 : 1) * cell.movementCost
        if (cost >= costs[index]) continue
        costs[index] = cost
        previous[index] = node.index
        const hx = Math.abs(goal.x - next.x),
          hz = Math.abs(goal.z - next.z)
        const heuristic = this.diagonal
          ? Math.max(hx, hz) + (Math.SQRT2 - 1) * Math.min(hx, hz)
          : hx + hz
        frontier.push({ index, cost, score: cost + heuristic, order: order++ })
      }
    }
    return null
  }
}
