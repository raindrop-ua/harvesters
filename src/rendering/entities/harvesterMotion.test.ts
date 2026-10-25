import { describe, expect, it } from 'vitest'
import {
  HARVESTER_PRESENTATION,
  HarvesterSuspension,
  localForwardSpeed,
} from './harvesterMotion'

function drive(fps: number, direction = 1) {
  const suspension = new HarvesterSuspension()
  const samples: { time: number; pitch: number }[] = []
  for (let frame = 0; frame < fps * 5; frame++) {
    const time = Math.floor((frame / fps + 1e-9) * 20) / 20
    const speed =
      direction *
      (time < 1 ? time * 5 : time < 2 ? 5 : time < 3 ? (3 - time) * 5 : 0)
    samples.push({
      time,
      pitch: suspension.update(speed, time, 1 / fps),
    })
  }
  return samples
}

describe('harvester presentation motion', () => {
  it('measures forward and reverse travel relative to the nose at any heading', () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (const direction of [-1, 1]) {
        const previousPosition = { x: 7, y: 0, z: -2 }
        const unit = {
          heading,
          previousPosition,
          position: {
            x: previousPosition.x + Math.sin(heading) * direction * 0.2,
            y: 0,
            z: previousPosition.z + Math.cos(heading) * direction * 0.2,
          },
        }
        expect(localForwardSpeed(unit, 0.05)).toBeCloseTo(direction * 4)
        unit.previousPosition = { ...unit.position }
        expect(localForwardSpeed(unit, 0.05)).toBe(0)
      }
    }
  })

  it('lifts the nose on acceleration, dips on braking, and settles without endless rocking', () => {
    const samples = drive(120)
    expect(samples.find((s) => s.time === 0.75)!.pitch).toBeLessThan(-0.025)
    expect(samples.find((s) => s.time === 2.75)!.pitch).toBeGreaterThan(0.025)
    expect(Math.abs(samples.at(-1)!.pitch)).toBeLessThan(0.00001)
    expect(Math.max(...samples.map((s) => Math.abs(s.pitch)))).toBeLessThan(
      HARVESTER_PRESENTATION.maxPitch * 1.15,
    )
  })

  it('mirrors suspension response when accelerating and braking in reverse', () => {
    const forward = drive(60),
      reverse = drive(60, -1)
    for (let i = 0; i < forward.length; i++)
      expect(reverse[i].pitch).toBeCloseTo(-forward[i].pitch, 10)
  })

  it('keeps the same restrained response at 30 and 144 FPS', () => {
    const a = drive(30),
      b = drive(144)
    for (const time of [0.5, 0.75, 1.5, 2.5, 2.75, 3.5, 4.5])
      expect(a.find((s) => s.time === time)!.pitch).toBeCloseTo(
        b.find((s) => s.time === time)!.pitch,
        2,
      )
    expect(Math.abs(a.at(-1)!.pitch - b.at(-1)!.pitch)).toBeLessThan(0.00001)
  })

  it('freezes on pause and bounds large frame gaps without destabilizing the spring', () => {
    const suspension = new HarvesterSuspension()
    suspension.update(0, 0, 1 / 60)
    suspension.update(3, 0.05, 1 / 60)
    const pitch = suspension.pitch
    for (let i = 0; i < 100; i++)
      expect(suspension.update(0, 0.05, 0)).toBe(pitch)
    const afterGap = suspension.update(0, 0.1, 10)
    expect(Number.isFinite(afterGap)).toBe(true)
    expect(Math.abs(afterGap)).toBeLessThan(
      HARVESTER_PRESENTATION.maxPitch * 1.15,
    )
  })
})
