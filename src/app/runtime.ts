import { createStore } from 'zustand/vanilla'
import { config } from '../game/config'
import { FixedLoop } from '../game/core/FixedLoop'
import { Simulation } from '../game/simulation/Simulation'
import type { EntityId, GridPosition, HarvesterState } from '../game/types'

export interface PostProcessingSettings {
  enabled: boolean
  grainIntensity: number
  chromaticAberrationIntensity: number
  vignetteIntensity: number
}
export interface UnitView {
  id: EntityId
  cargo: number
  capacity: number
  state: HarvesterState
  message: string
  position: GridPosition
  path: GridPosition[]
  deliveries: number
}
export interface ViewSnapshot {
  time: number
  balance: number
  deliveries: number
  units: UnitView[]
  dockOwner?: EntityId
  queue: EntityId[]
  deposits: { id: EntityId; fraction: number; amount: number }[]
  remaining: number
  fps: number
  gridRevision: number
}
export interface UIState {
  ready: boolean
  selectedId: EntityId | null
  developerOpen: boolean
  showGrid: boolean
  showPaths: boolean
  paused: boolean
  speed: number
  effects: PostProcessingSettings
  focus: { x: number; z: number; revision: number }
  view: ViewSnapshot
}

/** Owns browser scheduling and the low-frequency UI bridge; never owned by the canvas. */
export class GameRuntime {
  readonly labelElements = new Map<EntityId, HTMLDivElement>()
  readonly simulation = new Simulation()
  readonly loop = new FixedLoop(this.simulation)
  readonly ui = createStore<UIState>(() => ({
    ready: false,
    selectedId: this.world.units[0].id,
    developerOpen: false,
    showGrid: false,
    showPaths: false,
    paused: false,
    speed: 1,
    effects: { ...config.effects },
    focus: { x: -1, z: 1, revision: 0 },
    view: this.snapshot(60),
  }))
  get world() {
    return this.simulation.world
  }
  private snapshot(fps: number): ViewSnapshot {
    const w = this.world
    return {
      time: w.time,
      balance: w.economy.balances.mineral,
      deliveries: w.deliveries,
      units: w.units.map((u) => ({
        id: u.id,
        cargo: u.cargo,
        capacity: u.capacity,
        state: u.state,
        message: u.message,
        position: { x: u.position.x, z: u.position.z },
        path: u.path.slice(u.pathIndex),
        deliveries: u.deliveries,
      })),
      dockOwner: w.refinery?.reservedBy,
      queue: [...(w.refinery?.queue ?? [])],
      deposits: w.deposits.map((d) => ({
        id: d.id,
        fraction: d.amount / d.initialAmount,
        amount: d.amount,
      })),
      remaining: w.deposits.reduce((sum, d) => sum + d.amount, 0),
      fps,
      gridRevision: w.grid.revision,
    }
  }
  start(): () => void {
    let raf = 0,
      last = performance.now(),
      lastPublish = last,
      frames = 0
    const frame = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      const state = this.ui.getState()
      this.loop.paused = state.paused || !state.ready || document.hidden
      this.loop.speed = state.speed
      this.loop.advance(document.hidden ? 0 : delta)
      frames++
      if (now - lastPublish > 120) {
        this.ui.setState({
          view: this.snapshot(
            Math.round((frames * 1000) / (now - lastPublish)),
          ),
        })
        frames = 0
        lastPublish = now
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }
  focusUnit(
    id = this.ui.getState().selectedId ?? this.world.units[0].id,
  ): void {
    const u = this.world.units.find((unit) => unit.id === id)
    if (!u) return
    this.ui.setState((s) => ({
      selectedId: id,
      focus: {
        x: u.position.x,
        z: u.position.z,
        revision: s.focus.revision + 1,
      },
    }))
  }
  command(type: 'STOP' | 'AUTO' | 'RETURN_CARGO'): void {
    const unitId = this.ui.getState().selectedId
    if (unitId) this.simulation.commands.enqueue({ type, unitId })
  }
}
