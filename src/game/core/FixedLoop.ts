import { config } from '../config'
import type { Simulation } from '../simulation/Simulation'

/** Fixed-step clock, callable from any host. Hidden-tab time is intentionally discarded. */
export class FixedLoop {
  private accumulator = 0
  readonly dt = 1 / config.tickRate
  alpha = 0
  paused = false
  speed = 1
  constructor(readonly simulation: Simulation) {}
  advance(realDelta: number): void {
    if (!Number.isFinite(realDelta) || realDelta < 0) return
    if (this.paused) {
      this.alpha = 1
      return
    }
    this.accumulator += Math.min(realDelta, 0.25) * this.speed
    let steps = 0
    // Tolerate floating-point roundoff at exact tick boundaries (e.g. 30 vs 144 FPS).
    while (
      this.accumulator + 1e-9 >= this.dt &&
      steps < config.maxCatchUpSteps
    ) {
      this.simulation.step(this.dt)
      this.accumulator = Math.max(0, this.accumulator - this.dt)
      steps++
    }
    if (steps === config.maxCatchUpSteps) this.accumulator %= this.dt
    this.alpha = this.accumulator / this.dt
  }
}
