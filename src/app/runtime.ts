import { createStore } from 'zustand/vanilla'
import { config } from '../game/config'
import { FixedLoop } from '../game/core/FixedLoop'
import { Simulation } from '../game/simulation/Simulation'
import { HarvesterVoice } from '../audio/HarvesterVoice'
import { BackgroundMusic } from '../audio/BackgroundMusic'
import { isRegenerating } from '../game/simulation/MineralRegeneration'
import type {
  CommandResult,
  EntityId,
  GridPosition,
  HarvesterState,
  TankClass,
  MapTarget,
  Position,
} from '../game/types'

export type MapHover = MapTarget
export interface MoveFeedback {
  sequence: number
  unitId: EntityId
  position: Position
  accepted: boolean
  reason?: string
  order?: 'MOVE' | 'HARVEST' | 'RETURN_CARGO'
}

export interface PostProcessingSettings {
  enabled: boolean
  grainIntensity: number
  chromaticAberrationIntensity: number
  vignetteIntensity: number
}
interface CommonUnitView {
  id: EntityId
  state: HarvesterState
  message: string
  position: GridPosition
  path: GridPosition[]
}
export type UnitView = CommonUnitView &
  (
    | { kind: 'harvester'; cargo: number; capacity: number; deliveries: number }
    | { kind: 'tank'; tankClass: TankClass }
  )
export interface ViewSnapshot {
  time: number
  balance: number
  deliveries: number
  units: UnitView[]
  dockOwner?: EntityId
  queue: EntityId[]
  deposits: {
    id: EntityId
    fraction: number
    amount: number
    regenerating: boolean
  }[]
  remaining: number
  fps: number
  gridRevision: number
}
export interface UIState {
  ready: boolean
  selectedId: EntityId | null
  moveFeedback: MoveFeedback | null
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
  constructor(private readonly voice = new HarvesterVoice()) {}
  mapHover: MapHover | null = null
  private moveSequence = 0
  readonly music = new BackgroundMusic()
  readonly labelElements = new Map<EntityId, HTMLDivElement>()
  readonly simulation = new Simulation()
  readonly loop = new FixedLoop(this.simulation)
  readonly ui = createStore<UIState>(() => ({
    ready: false,
    selectedId: this.world.units[0].id,
    moveFeedback: null,
    developerOpen: false,
    showGrid: false,
    showPaths: false,
    paused: false,
    speed: 1,
    effects: { ...config.effects },
    focus: { ...config.camera.initialFocus, revision: 0 },
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
      units: w.vehicles.map((u) => ({
        id: u.id,
        ...(u.kind === 'harvester'
          ? {
              kind: u.kind,
              cargo: u.cargo,
              capacity: u.capacity,
              deliveries: u.deliveries,
            }
          : { kind: u.kind, tankClass: u.tankClass }),
        state: u.state,
        message: u.message,
        position: { x: u.position.x, z: u.position.z },
        path: u.path.slice(u.pathIndex),
      })),
      dockOwner: w.refinery?.reservedBy,
      queue: [...(w.refinery?.queue ?? [])],
      deposits: w.deposits.map((d) => ({
        id: d.id,
        fraction: d.amount / d.initialAmount,
        amount: d.amount,
        regenerating: isRegenerating(w, d),
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
    const visibility = () => {
      if (document.hidden) this.voice.stop()
      this.music.setHidden(document.hidden)
    }
    const activateMusic = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-music-controls]')
      )
        return
      if (
        event instanceof KeyboardEvent &&
        (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
      )
        return
      this.music.activate()
    }
    this.music.setHidden(document.hidden)
    window.addEventListener('pointerdown', activateMusic, true)
    window.addEventListener('keydown', activateMusic, true)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pointerdown', activateMusic, true)
      window.removeEventListener('keydown', activateMusic, true)
      this.voice.stop()
      this.music.stop()
    }
  }
  selectUnit(id: EntityId): void {
    if (!this.world.vehicles.some((unit) => unit.id === id)) return
    this.ui.setState({ selectedId: id, moveFeedback: null })
    this.voice.play('selection')
  }
  mapTarget(
    kind: MapHover['kind'],
    point: GridPosition,
    id?: EntityId,
  ): MapTarget {
    const cell = this.world.grid.worldToGrid(point)
    // Tiny/depleted crystals and holes between model parts still use their logical footprint.
    const occupied =
      kind === 'ground' ? this.world.grid.get(cell)?.occupiedBy : undefined
    const deposit = this.world.deposits.find((d) => d.id === (id ?? occupied))
    if (kind === 'deposit' || (kind === 'ground' && deposit))
      return { kind: 'deposit', id: deposit?.id ?? id!, cell }
    if (
      kind === 'refinery' ||
      (kind === 'ground' && occupied === this.world.refinery?.id && occupied)
    )
      return { kind: 'refinery', id: id ?? occupied!, cell }
    return {
      kind:
        kind === 'unit' ? 'unit' : kind === 'blocked' ? 'blocked' : 'ground',
      cell,
    }
  }
  hoverMap(kind: MapHover['kind'], point: GridPosition, id?: EntityId): void {
    this.mapHover = this.mapTarget(kind, point, id)
  }
  orderSelected(target: MapTarget, position: Position): CommandResult {
    const { selectedId, ready } = this.ui.getState()
    if (!selectedId || !ready)
      return { accepted: false, reason: 'No unit selected' }
    const command = this.simulation.mapOrder(selectedId, target)
    const result = command
      ? this.simulation.commands.enqueue(command)
      : { accepted: false, reason: 'Destination blocked' }
    this.showMoveFeedback(
      position,
      result,
      command && command.type !== 'STOP' && command.type !== 'AUTO'
        ? command.type
        : undefined,
    )
    if (result.accepted) this.voice.play('move')
    return result
  }
  moveSelected(destination: GridPosition): CommandResult {
    const { selectedId, ready } = this.ui.getState()
    if (!selectedId || !ready)
      return { accepted: false, reason: 'No unit selected' }
    const result = this.simulation.commands.enqueue({
      type: 'MOVE',
      unitId: selectedId,
      destination,
    })
    if (Number.isFinite(destination.x) && Number.isFinite(destination.z))
      this.showMoveFeedback(
        this.world.grid.gridToWorld(destination),
        result,
        'MOVE',
      )
    if (result.accepted) this.voice.play('move')
    return result
  }
  private showMoveFeedback(
    position: Position,
    result: CommandResult,
    order?: MoveFeedback['order'],
  ): void {
    const { selectedId, ready } = this.ui.getState()
    if (!selectedId || !ready) return
    this.ui.setState({
      moveFeedback: {
        sequence: ++this.moveSequence,
        unitId: selectedId,
        position: { ...position },
        ...result,
        order,
      },
    })
  }
  focusUnit(
    id = this.ui.getState().selectedId ?? this.world.units[0].id,
  ): void {
    const u = this.world.vehicles.find((unit) => unit.id === id)
    if (!u) return
    this.selectUnit(id)
    this.ui.setState((s) => ({
      focus: {
        x: u.position.x,
        z: u.position.z,
        revision: s.focus.revision + 1,
      },
    }))
  }
  command(type: 'STOP' | 'AUTO' | 'RETURN_CARGO'): void {
    const unitId = this.ui.getState().selectedId
    if (unitId) {
      this.simulation.commands.enqueue({ type, unitId })
      this.ui.setState({ moveFeedback: null })
    }
  }
}
