import { describe, expect, it } from 'vitest'
import { SMOKE, SmokeEmitter } from './SmokeEmitter'

describe('refinery smoke lifecycle', () => {
  it('emits only when enabled, with the first puff at the start of unloading', () => {
    const emitter = new SmokeEmitter()
    emitter.update(10, false)
    expect(emitter.births.every((birth) => birth === -Infinity)).toBe(true)
    emitter.update(10.05, true)
    expect(emitter.births.filter(Number.isFinite)).toEqual([10.05])
    emitter.update(10.1, true)
    expect(emitter.births.filter(Number.isFinite)).toHaveLength(1)
  })

  it('lets existing smoke dissipate after unloading without spawning more', () => {
    const emitter = new SmokeEmitter()
    for (let frame = 0; frame < 6 * 60; frame++)
      emitter.update(frame / 60, true)
    const births = [...emitter.births]
    expect(
      births.filter((birth) => 6 - birth < SMOKE.lifetime).length,
    ).toBeGreaterThan(5)
    emitter.update(6 + SMOKE.lifetime, false)
    expect(emitter.births).toEqual(births)
    expect(
      emitter.births.every(
        (birth) => 6 + SMOKE.lifetime - birth >= SMOKE.lifetime,
      ),
    ).toBe(true)
  })

  it('freezes on identical simulation timestamps and resumes for the next delivery', () => {
    const emitter = new SmokeEmitter()
    emitter.update(1, true)
    const births = [...emitter.births]
    for (let i = 0; i < 120; i++) emitter.update(1, true)
    expect(emitter.births).toEqual(births)
    emitter.update(1.5, false)
    emitter.update(2, true)
    expect(emitter.births.filter(Number.isFinite)).toEqual([1, 2])
  })

  it('keeps a fixed pool during long operation and emits no burst after a clock gap', () => {
    const emitter = new SmokeEmitter()
    for (let frame = 0; frame < 120 * 60; frame++)
      emitter.update(frame / 60, true)
    expect(emitter.births).toHaveLength(SMOKE.count)
    emitter.update(1000, true)
    expect(emitter.births.filter((birth) => birth === 1000)).toHaveLength(1)
    expect(
      emitter.births.filter((birth) => 1000 - birth < SMOKE.lifetime),
    ).toHaveLength(1)
  })
})
