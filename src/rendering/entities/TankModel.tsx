import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MathUtils } from 'three'
import { useGame, useUI } from '../../app/GameContext'
import type { Tank } from '../../game/types'
import { angleDelta } from '../../game/simulation/Simulation'
import { useModel } from '../models'

export function TankModel({ unit }: { unit: Tank }) {
  const game = useGame(),
    model = useModel(`tank-${unit.tankClass}`),
    effects = useModel('effects')
  const selected = useUI((s) => s.selectedId === unit.id)
  const [hovered, setHovered] = useState(false)
  const root = useRef<Group>(null),
    selection = useRef<Group>(null)
  const ring = useMemo(
    () => effects.getObjectByName('SelectionRing')!,
    [effects],
  )
  const turret = model.getObjectByName('TurretYaw')!
  useFrame(() => {
    if (!root.current) return
    const alpha = game.loop.alpha,
      grid = game.world.grid
    const x = MathUtils.lerp(unit.previousPosition.x, unit.position.x, alpha),
      z = MathUtils.lerp(unit.previousPosition.z, unit.position.z, alpha)
    const heading =
      unit.previousHeading +
      angleDelta(unit.previousHeading, unit.heading) * alpha
    const slopeX = (grid.heightAt(x + 0.6, z) - grid.heightAt(x - 0.6, z)) / 1.2
    const slopeZ = (grid.heightAt(x, z + 0.6) - grid.heightAt(x, z - 0.6)) / 1.2
    root.current.position.set(x, grid.heightAt(x, z) + 0.06, z)
    root.current.rotation.set(
      -Math.atan(slopeZ * Math.cos(heading) + slopeX * Math.sin(heading)),
      heading,
      Math.atan(slopeX * Math.cos(heading) - slopeZ * Math.sin(heading)),
      'YXZ',
    )
    turret.rotation.y =
      unit.previousTurretHeading +
      angleDelta(unit.previousTurretHeading, unit.turretHeading) * alpha
    selection.current?.position.set(x, grid.heightAt(x, z) + 0.12, z)
  })
  return (
    <>
      <group
        ref={root}
        name={unit.id}
        onClick={(event) => {
          event.stopPropagation()
          if (event.button === 0 && event.delta <= 5) game.selectUnit(unit.id)
        }}
        onPointerMove={(event) => {
          event.stopPropagation()
          game.hoverMap('unit', event.point)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          game.hoverMap('unit', event.point)
          setHovered(true)
        }}
        onPointerOut={() => {
          setHovered(false)
          game.mapHover = null
        }}
      >
        <primitive object={model} dispose={null} />
      </group>
      <group
        ref={selection}
        visible={selected || hovered}
        scale={
          unit.tankClass === 'light'
            ? 0.8
            : unit.tankClass === 'heavy'
              ? 1.15
              : 1
        }
      >
        <primitive object={ring} dispose={null} />
      </group>
    </>
  )
}
