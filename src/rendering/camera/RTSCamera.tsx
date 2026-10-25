import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, OrthographicCamera, Vector3 } from 'three'
import { config } from '../../game/config'
import { useGame } from '../../app/GameContext'

const settings = config.camera
const azimuth = MathUtils.degToRad(settings.azimuth)
const elevation = MathUtils.degToRad(settings.elevation)
const offset = new Vector3(
  Math.sin(azimuth) * Math.cos(elevation),
  Math.sin(elevation),
  Math.cos(azimuth) * Math.cos(elevation),
).multiplyScalar(120)
const right = new Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth))
const forward = new Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth))

export function RTSCamera() {
  const game = useGame()
  const { camera, gl, size } = useThree()
  const initialFocus =
    size.width < 750
      ? {
          x:
            (game.world.refineryPosition.x + game.world.courtyardPosition.x) /
            2,
          z:
            (game.world.refineryPosition.z + game.world.courtyardPosition.z) /
            2,
        }
      : settings.initialFocus
  const target = useRef(new Vector3(initialFocus.x, 0, initialFocus.z))
  const current = useRef(new Vector3(initialFocus.x, 0, initialFocus.z))
  const zoom = useRef<number>(settings.initialZoom)
  const keys = useRef(new Set<string>())

  useEffect(() => {
    const ortho = camera as OrthographicCamera
    ortho.zoom = Math.min(
      settings.initialZoom,
      Math.max(settings.minZoom, size.width / 65),
    )
    zoom.current = ortho.zoom
    ortho.updateProjectionMatrix()
  }, [camera, size.width])

  useEffect(() => {
    const ignored = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    const down = (event: KeyboardEvent) => {
      if (ignored(event.target)) return
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(event.code)
      ) {
        keys.current.add(event.code)
        event.preventDefault()
      }
    }
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
    }
    const blur = () => keys.current.clear()
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      zoom.current = MathUtils.clamp(
        zoom.current * Math.exp(-event.deltaY * 0.0012),
        settings.minZoom,
        settings.maxZoom,
      )
    }
    const element = gl.domElement
    // Middle-button drag and one-finger touch pan preserve left-click selection.
    let dragging = false,
      pointerX = 0,
      pointerY = 0
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 1 || event.pointerType === 'touch') {
        dragging = true
        pointerX = event.clientX
        pointerY = event.clientY
        element.setPointerCapture(event.pointerId)
        event.preventDefault()
      }
    }
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = (event.clientX - pointerX) / zoom.current
      const dy = (event.clientY - pointerY) / zoom.current / Math.sin(elevation)
      target.current.addScaledVector(right, -dx).addScaledVector(forward, dy)
      pointerX = event.clientX
      pointerY = event.clientY
    }
    const pointerUp = () => {
      dragging = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('pointerdown', pointerDown)
    element.addEventListener('pointermove', pointerMove)
    element.addEventListener('pointerup', pointerUp)
    element.addEventListener('pointercancel', pointerUp)
    const unsubscribe = game.ui.subscribe((state, previous) => {
      if (state.focus.revision !== previous.focus.revision)
        target.current.set(state.focus.x, 0, state.focus.z)
    })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('pointerdown', pointerDown)
      element.removeEventListener('pointermove', pointerMove)
      element.removeEventListener('pointerup', pointerUp)
      element.removeEventListener('pointercancel', pointerUp)
      unsubscribe()
    }
  }, [game, gl, size.width])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05),
      pressed = keys.current
    const speed = settings.speed * dt * (settings.initialZoom / zoom.current)
    if (pressed.has('KeyW') || pressed.has('ArrowUp'))
      target.current.addScaledVector(forward, speed)
    if (pressed.has('KeyS') || pressed.has('ArrowDown'))
      target.current.addScaledVector(forward, -speed)
    if (pressed.has('KeyD') || pressed.has('ArrowRight'))
      target.current.addScaledVector(right, speed)
    if (pressed.has('KeyA') || pressed.has('ArrowLeft'))
      target.current.addScaledVector(right, -speed)
    target.current.x = MathUtils.clamp(
      target.current.x,
      -settings.bounds,
      settings.bounds,
    )
    target.current.z = MathUtils.clamp(
      target.current.z,
      -settings.bounds,
      settings.bounds,
    )
    const blend = 1 - Math.exp(-settings.smoothing * dt)
    current.current.lerp(target.current, blend)
    camera.position.copy(current.current).add(offset)
    camera.lookAt(current.current)
    const ortho = camera as OrthographicCamera
    ortho.zoom = MathUtils.lerp(ortho.zoom, zoom.current, blend)
    ortho.updateProjectionMatrix()
  })
  return null
}
