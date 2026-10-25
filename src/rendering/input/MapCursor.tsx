import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from '../../app/GameContext'

export function MapCursor() {
  const game = useGame(),
    { gl } = useThree()
  const pointer = useRef({
    inside: false,
    panning: false,
    lastCheck: -Infinity,
  })
  useEffect(() => {
    const canvas = gl.domElement
    const enter = () => {
      pointer.current.inside = true
    }
    const leave = () => {
      pointer.current.inside = false
      pointer.current.panning = false
      game.mapHover = null
      canvas.style.cursor = ''
      delete canvas.dataset.orderCursor
    }
    const down = (event: PointerEvent) => {
      pointer.current.panning = event.button === 1
    }
    const up = () => {
      pointer.current.panning = false
    }
    canvas.addEventListener('pointerenter', enter)
    canvas.addEventListener('pointermove', enter)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', leave)
    window.addEventListener('blur', leave)
    return () => {
      canvas.removeEventListener('pointerenter', enter)
      canvas.removeEventListener('pointermove', enter)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', leave)
      window.removeEventListener('blur', leave)
      leave()
    }
  }, [game, gl])
  useFrame(({ clock, events }) => {
    if (
      !pointer.current.inside ||
      clock.elapsedTime - pointer.current.lastCheck < 0.1
    )
      return
    pointer.current.lastCheck = clock.elapsedTime
    // Refresh under a stationary pointer as the camera and vehicles move.
    events.update?.()
    const hover = game.mapHover,
      state = game.ui.getState()
    let mode = 'default',
      cursor = 'default'
    if (pointer.current.panning) {
      mode = 'pan'
      cursor = 'grabbing'
    } else if (hover?.kind === 'unit') {
      mode = 'select'
      cursor = 'pointer'
    } else if (hover && state.selectedId && state.ready) {
      const valid = game.simulation.previewMapOrder(
        state.selectedId,
        hover,
      ).accepted
      mode = valid
        ? hover.kind === 'deposit'
          ? 'harvest'
          : hover.kind === 'refinery'
            ? 'unload'
            : 'move'
        : 'blocked'
      cursor = `url("/cursors/${mode}.svg") 16 16, ${valid ? 'crosshair' : 'not-allowed'}`
    }
    gl.domElement.style.cursor = cursor
    gl.domElement.dataset.orderCursor = mode
  })
  return null
}
