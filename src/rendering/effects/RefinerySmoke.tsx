import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, Vector3, type Material, type Object3D } from 'three'
import { useGame } from '../../app/GameContext'
import { useModel } from '../models'
import { SMOKE, SmokeEmitter } from './SmokeEmitter'

export function RefinerySmoke({ outlet }: { outlet: Object3D }) {
  const game = useGame(),
    model = useModel('smoke')
  const source = model.getObjectByName('SmokeParticle') as Mesh
  const emitter = useMemo(() => new SmokeEmitter(), []),
    position = useMemo(() => new Vector3(), [])
  const puffs = useMemo(
    () =>
      Array.from({ length: SMOKE.count }, (_, index) => {
        const material = (source.material as Material).clone()
        material.transparent = true
        material.depthWrite = false
        material.opacity = 0
        const mesh = new Mesh(source.geometry, material)
        mesh.name = `RefinerySmokePuff-${index}`
        mesh.visible = false
        return mesh
      }),
    [source],
  )
  useEffect(
    () => () => {
      for (const puff of puffs) puff.material.dispose()
    },
    [puffs],
  )
  useFrame(() => {
    const world = game.world,
      time = world.time
    const unloading = world.units.some(
      (unit) =>
        unit.state === 'UNLOAD' &&
        unit.cargo > 0 &&
        world.refinery?.canAccept(unit.id),
    )
    // Frozen timestamps retain existing puffs, without emitting extra smoke on pause.
    if (!game.loop.paused) emitter.update(time, unloading)
    outlet.getWorldPosition(position)
    for (let i = 0; i < puffs.length; i++) {
      const puff = puffs[i],
        age = time - emitter.births[i],
        phase = age / SMOKE.lifetime
      puff.visible = phase >= 0 && phase < 1
      if (!puff.visible) continue
      puff.position.set(
        position.x + age * 0.65 + Math.sin(i * 2.4 + age) * age * 0.1,
        position.y + age * 1.15,
        position.z - age * 0.28 + Math.cos(i * 1.8 + age) * age * 0.08,
      )
      const size = 0.35 + phase * 1.05
      puff.scale.set(size, size * 0.85, size)
      puff.rotation.set(phase * 0.2, i * 1.7 + phase * 0.45, 0)
      puff.material.opacity = Math.sin(phase * Math.PI) ** 0.7 * 0.24
    }
  })
  return (
    <group name="RefinerySmoke">
      {puffs.map((puff) => (
        <primitive key={puff.uuid} object={puff} dispose={null} />
      ))}
    </group>
  )
}
