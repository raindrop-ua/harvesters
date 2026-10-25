import type { ThreeEvent } from '@react-three/fiber'
import type { MapTarget } from '../../game/types'
import { useGame } from '../../app/GameContext'

/** The nearest visible surface consumes the click, preventing orders through buildings. */
export function useMapSurface(
  target: boolean | { kind: 'deposit' | 'refinery'; id: string } = false,
) {
  const game = useGame()
  const kind: MapTarget['kind'] =
    typeof target === 'boolean' ? (target ? 'blocked' : 'ground') : target.kind
  const id = typeof target === 'boolean' ? undefined : target.id
  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    game.hoverMap(kind, event.point, id)
  }
  return {
    onPointerMove: hover,
    onPointerOver: hover,
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (event.button !== 0 || event.delta > 5) return
      game.orderSelected(game.mapTarget(kind, event.point, id), event.point)
    },
  }
}
