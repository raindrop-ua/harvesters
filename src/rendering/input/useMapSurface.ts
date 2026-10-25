import type { ThreeEvent } from '@react-three/fiber'
import { useGame } from '../../app/GameContext'

/** The nearest visible surface consumes the click, preventing orders through buildings. */
export function useMapSurface(blocked = false) {
  const game = useGame()
  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    game.hoverMap(blocked ? 'blocked' : 'ground', event.point)
  }
  return {
    onPointerMove: hover,
    onPointerOver: hover,
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (event.button !== 0 || event.delta > 5) return
      if (blocked) game.rejectMapMove(event.point)
      else game.moveSelected(game.world.grid.worldToGrid(event.point))
    },
  }
}
