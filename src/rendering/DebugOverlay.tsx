import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useGame, useUI } from '../app/GameContext'
import { BufferGeometry, Float32BufferAttribute } from 'three'

export function DebugOverlay() {
  const game = useGame(),
    showGrid = useUI((s) => s.showGrid),
    showPaths = useUI((s) => s.showPaths)
  const units = useUI((s) => s.view.units)
  const revision = useUI((s) => s.view.gridRevision)
  const grid = game.world.grid
  const geometry = useMemo(() => {
    if (!showGrid) return null
    const vertices: number[] = [],
      colors: number[] = []
    for (const cell of grid.cells) {
      const wx = cell.x * grid.cellSize - grid.halfSize,
        wz = cell.z * grid.cellSize - grid.halfSize
      const s = grid.cellSize
      for (const [ax, az, bx, bz] of [
        [wx, wz, wx + s, wz],
        [wx, wz, wx, wz + s],
      ]) {
        vertices.push(
          ax,
          grid.heightAt(ax, az) + 0.07,
          az,
          bx,
          grid.heightAt(bx, bz) + 0.07,
          bz,
        )
        const color = cell.walkable ? [0.25, 0.39, 0.3] : [0.9, 0.17, 0.08]
        colors.push(...color, ...color)
      }
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    result.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return result
    // Occupancy can change when a deposit is exhausted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, showGrid, revision])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return (
    <>
      {geometry && (
        <lineSegments geometry={geometry}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </lineSegments>
      )}
      {showPaths &&
        units
          .filter((u) => u.path.length > 1)
          .map((u, i) => (
            <Line
              key={u.id}
              points={u.path.map((p) => {
                const w = grid.gridToWorld(p)
                return [w.x, w.y + 0.25, w.z]
              })}
              color={i === 0 ? '#c7ffef' : '#ffe9a7'}
              lineWidth={1.4}
              dashed
              dashSize={0.45}
              gapSize={0.3}
            />
          ))}
    </>
  )
}
