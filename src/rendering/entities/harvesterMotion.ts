import type { Harvester } from '../../game/types'

export const HARVESTER_PRESENTATION = {
  bodyPivotHeight: 1.25,
  pitchPerAcceleration: 0.008,
  maxPitch: 0.04,
  springFrequency: 10,
  dampingRatio: 0.62,
} as const

/** Positive is nose first; negative is reverse, including the tick leaving UNDOCK. */
export function localForwardSpeed(
  unit: Pick<Harvester, 'position' | 'previousPosition' | 'heading'>,
  tickDelta: number,
): number {
  return (
    ((unit.position.x - unit.previousPosition.x) * Math.sin(unit.heading) +
      (unit.position.z - unit.previousPosition.z) * Math.cos(unit.heading)) /
    tickDelta
  )
}

/** Presentation-only suspension. Samples fixed-tick velocity, settles at render rate. */
export class HarvesterSuspension {
  pitch = 0
  private angularVelocity = 0
  private sampleTime?: number
  private previousSpeed = 0
  private targetPitch = 0

  update(speed: number, simulationTime: number, delta: number): number {
    if (delta <= 0) return this.pitch
    const tuning = HARVESTER_PRESENTATION
    if (this.sampleTime !== undefined && simulationTime > this.sampleTime) {
      const acceleration =
        (speed - this.previousSpeed) / (simulationTime - this.sampleTime)
      // Forward acceleration lifts the nose; braking dips it. Reverse mirrors both.
      this.targetPitch = Math.max(
        -tuning.maxPitch,
        Math.min(tuning.maxPitch, -acceleration * tuning.pitchPerAcceleration),
      )
    }
    if (this.sampleTime === undefined || simulationTime > this.sampleTime) {
      this.sampleTime = simulationTime
      this.previousSpeed = speed
    }
    // Small substeps keep the damped spring stable at low FPS and 4× simulation speed.
    let remaining = Math.min(delta, 0.1)
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, 1 / 120)
      this.angularVelocity +=
        ((this.targetPitch - this.pitch) * tuning.springFrequency ** 2 -
          2 *
            tuning.dampingRatio *
            tuning.springFrequency *
            this.angularVelocity) *
        dt
      this.pitch += this.angularVelocity * dt
      remaining -= dt
    }
    return this.pitch
  }
}
