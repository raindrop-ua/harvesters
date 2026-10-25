import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, MathUtils, Mesh, Object3D } from 'three'
import { useGame } from '../../app/GameContext'
import { useModel } from '../models'
import type { Vehicle } from '../../game/types'
import { angleDelta } from '../../game/simulation/Simulation'
import { localForwardSpeed } from '../entities/harvesterMotion'

const COUNT = 22
/** Both particle geometries come from effects.blend; instances only animate their transforms. */
export function Particles({ unit }: { unit: Vehicle }) {
  const game = useGame(),
    model = useModel('effects')
  const dust = model.getObjectByName('DustParticle') as Mesh
  const crystal = model.getObjectByName('ExtractionParticle') as Mesh
  const dustRef = useRef<InstancedMesh>(null),
    crystalRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(() => {
    const u = unit,
      time = game.world.time,
      alpha = game.loop.alpha,
      positionX = MathUtils.lerp(u.previousPosition.x, u.position.x, alpha),
      positionZ = MathUtils.lerp(u.previousPosition.z, u.position.z, alpha),
      heading =
        u.previousHeading + angleDelta(u.previousHeading, u.heading) * alpha,
      signedSpeed = localForwardSpeed(u, game.loop.dt),
      direction = signedSpeed < 0 ? -1 : 1
    for (let i = 0; i < COUNT; i++) {
      const phase = (time * 0.8 + i / COUNT) % 1
      const side = i % 2 ? -1 : 1
      const dx = side * (1.8 + phase * 1.0)
      const dz = -direction * (1.5 + phase * 2.2)
      const x = positionX + Math.cos(heading) * dx + Math.sin(heading) * dz
      const z = positionZ - Math.sin(heading) * dx + Math.cos(heading) * dz
      dummy.position.set(
        x,
        game.world.grid.heightAt(x, z) + phase * 0.8 + 0.1,
        z,
      )
      dummy.scale.setScalar(
        Math.abs(signedSpeed) > 0.4 ? Math.sin(phase * Math.PI) * 0.22 : 0,
      )
      dummy.updateMatrix()
      dustRef.current?.setMatrixAt(i, dummy.matrix)
      const extracting = u.state === 'HARVEST',
        unloading = u.state === 'UNLOAD'
      const forward = extracting ? 3.3 + phase : 2.3 + phase * 1.4
      dummy.position.set(
        u.position.x +
          Math.sin(u.heading) * forward +
          Math.cos(i * 3.9) * phase,
        u.position.y + 0.8 + phase * 2.3,
        u.position.z +
          Math.cos(u.heading) * forward +
          Math.sin(i * 2.3) * phase,
      )
      dummy.scale.setScalar(
        extracting || unloading ? Math.sin(phase * Math.PI) * 0.09 : 0,
      )
      dummy.rotation.set(phase * 4, i, phase * 3)
      dummy.updateMatrix()
      crystalRef.current?.setMatrixAt(i, dummy.matrix)
    }
    if (dustRef.current) dustRef.current.instanceMatrix.needsUpdate = true
    if (crystalRef.current) crystalRef.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh
        name={`Dust-${unit.id}`}
        ref={dustRef}
        args={[dust.geometry, dust.material, COUNT]}
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={crystalRef}
        args={[crystal.geometry, crystal.material, COUNT]}
        frustumCulled={false}
        dispose={null}
      />
    </>
  )
}
