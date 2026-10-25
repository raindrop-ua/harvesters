import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { useState } from 'react'
import { Group, MathUtils } from 'three'
import { useGame, useUI } from '../../app/GameContext'
import { layout } from '../../game/simulation/World'
import { angleDelta } from '../../game/simulation/Simulation'
import type { Deposit } from '../../game/types'
import { useModel } from '../models'

export function TerrainModel() {
  const model = useModel('terrain')
  return <primitive object={model} dispose={null} />
}

export function RockModel({ index }: { index: number }) {
  const game = useGame(),
    rock = layout.rocks[index]
  const model = useModel('rocks')
  return (
    <primitive
      object={model}
      dispose={null}
      position={[rock.x, game.world.grid.heightAt(rock.x, rock.z), rock.z]}
      scale={rock.scale}
      rotation-y={rock.rotation}
    />
  )
}

export function MineralModel({ deposit }: { deposit: Deposit }) {
  const game = useGame(),
    model = useModel('minerals')
  const group = useRef<Group>(null)
  const p = game.world.grid.gridToWorld(deposit.cell)
  useFrame(() => {
    if (!group.current) return
    group.current.visible = deposit.amount > 0
    group.current.scale.setScalar(
      deposit.scale *
        (0.3 + 0.7 * Math.sqrt(deposit.amount / deposit.initialAmount)),
    )
  })
  return (
    <group
      ref={group}
      position={[p.x, p.y, p.z]}
      rotation-y={deposit.cell.x * 1.7}
    >
      <primitive object={model} dispose={null} />
    </group>
  )
}

export function RefineryModel() {
  const game = useGame(),
    model = useModel('refinery'),
    p = game.world.refineryPosition
  const lamp = model.getObjectByName('DockStatusLight')
  useFrame(({ clock }) => {
    if (lamp) {
      const unloading = game.world.unit.state === 'UNLOAD'
      lamp.scale.x = unloading ? 1 + Math.sin(clock.elapsedTime * 8) * 0.15 : 1
      lamp.visible = !unloading || Math.sin(clock.elapsedTime * 8) > -0.2
    }
  })
  return <primitive object={model} dispose={null} position={[p.x, p.y, p.z]} />
}

export function HarvesterModel() {
  const game = useGame(),
    model = useModel('harvester'),
    effects = useModel('effects')
  const selected = useUI((s) => s.selected)
  const group = useRef<Group>(null),
    selection = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  // R3F reparents this node into the selection group. Retain it across rerenders.
  const ring = useMemo(
    () => effects.getObjectByName('SelectionRing')!,
    [effects],
  )
  const rotor = model.getObjectByName('MiningRotor')
  const fill = model.getObjectByName('CargoFill')
  const leftTreads = model.getObjectByName('LeftTrackTreads')
  const rightTreads = model.getObjectByName('RightTrackTreads')

  useFrame((_, delta) => {
    const u = game.world.unit,
      alpha = game.loop.alpha
    if (!group.current) return
    const x = MathUtils.lerp(u.previousPosition.x, u.position.x, alpha)
    const z = MathUtils.lerp(u.previousPosition.z, u.position.z, alpha)
    const grid = game.world.grid
    group.current.position.set(x, grid.heightAt(x, z) + 0.06, z)
    const heading =
      u.previousHeading + angleDelta(u.previousHeading, u.heading) * alpha
    group.current.rotation.y = heading
    const slopeX = (grid.heightAt(x + 0.6, z) - grid.heightAt(x - 0.6, z)) / 1.2
    const slopeZ = (grid.heightAt(x, z + 0.6) - grid.heightAt(x, z - 0.6)) / 1.2
    group.current.rotation.x =
      Math.atan(slopeZ * Math.cos(heading) + slopeX * Math.sin(heading)) * -1
    group.current.rotation.z = Math.atan(
      slopeX * Math.cos(heading) - slopeZ * Math.sin(heading),
    )
    const visualTime = game.world.time
    if (rotor && !game.ui.getState().paused && u.state === 'HARVEST')
      rotor.rotation.x += delta * 7 * game.loop.speed
    if (fill) {
      fill.visible = u.cargo > 0
      fill.scale.y = Math.max(0.02, u.cargo / u.capacity)
    }
    const treadOffset = u.speed > 0.1 ? Math.sin(visualTime * 30) * 0.095 : 0
    if (leftTreads) leftTreads.position.z = treadOffset
    if (rightTreads) rightTreads.position.z = treadOffset
    if (selection.current)
      selection.current.position.set(x, grid.heightAt(x, z) + 0.12, z)
  })

  return (
    <>
      <group
        ref={group}
        onClick={(event) => {
          event.stopPropagation()
          game.ui.setState({ selected: true })
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <primitive object={model} dispose={null} />
      </group>
      <group ref={selection} visible={selected || hovered}>
        <primitive object={ring} dispose={null} />
      </group>
    </>
  )
}
