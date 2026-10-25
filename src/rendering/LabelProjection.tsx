import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'
import { useGame } from '../app/GameContext'

/** Fast DOM transforms only; React and gameplay never receive per-frame screen coordinates. */
export function LabelProjection() {
  const game = useGame(),
    projected = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const place = (id: string, x: number, y: number, z: number) => {
      const element = game.labelElements.get(id)
      if (!element) return
      projected.set(x, y, z).project(camera)
      element.style.visibility =
        Math.abs(projected.x) < 1.1 &&
        Math.abs(projected.y) < 1.1 &&
        projected.z >= -1 &&
        projected.z <= 1
          ? 'visible'
          : 'hidden'
      element.style.transform = `translate(${((projected.x + 1) * size.width) / 2}px,${((1 - projected.y) * size.height) / 2}px) translate(-50%,-50%)`
    }
    for (const unit of game.world.units) {
      const alpha = game.loop.alpha
      const x = MathUtils.lerp(unit.previousPosition.x, unit.position.x, alpha),
        z = MathUtils.lerp(unit.previousPosition.z, unit.position.z, alpha)
      place(unit.id, x, game.world.grid.heightAt(x, z) + 4.5, z)
    }
    for (const d of game.world.deposits) {
      const p = game.world.grid.gridToWorld(d.cell)
      place(d.id, p.x, p.y + 5.3 * d.scale, p.z)
    }
    const yard = game.world.courtyardPosition
    place('courtyard-01', yard.x, yard.y + 0.5, yard.z + 8.6)
  })
  return null
}
