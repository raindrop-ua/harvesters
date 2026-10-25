export const SMOKE = { count: 14, interval: 0.28, lifetime: 3.8 } as const

/** Bounded presentation pool, driven only by simulation timestamps. */
export class SmokeEmitter {
  readonly births: number[] = Array(SMOKE.count).fill(-Infinity)
  private next = 0
  private nextAt = 0
  private emitting = false

  update(time: number, emitting: boolean): void {
    if (emitting && !this.emitting) this.nextAt = time
    if (emitting && time >= this.nextAt) {
      this.births[this.next] = time
      this.next = (this.next + 1) % this.births.length
      this.nextAt = time + SMOKE.interval
    }
    this.emitting = emitting
  }
}
