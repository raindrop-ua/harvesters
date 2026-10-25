import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GameRuntime } from '../app/runtime'
import {
  HARVESTER_SELECTION_VOICES,
  HARVESTER_MOVE_VOICES,
  HarvesterVoice,
} from './HarvesterVoice'

function fixture(random = () => 0) {
  const player = {
    src: '',
    preload: '' as HTMLAudioElement['preload'],
    volume: 1,
    currentTime: 0,
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
  }
  const create = vi.fn(() => player)
  return { player, create, voice: new HarvesterVoice(create, random) }
}

describe('harvester selection acknowledgements', () => {
  it('includes all four distinct MP3 assets in the voice pool', () => {
    const files = HARVESTER_SELECTION_VOICES.map((path) =>
      readFileSync(
        fileURLToPath(new URL(`../../public${path}`, import.meta.url)),
      ),
    )
    expect(files).toHaveLength(4)
    for (const file of files) {
      expect(file.subarray(0, 3).toString()).toBe('ID3')
      expect(file.length).toBeGreaterThan(1000)
    }
    expect(new Set(files.map((file) => file.toString('base64'))).size).toBe(4)
  })
  it('can randomly choose every take and never repeats the previous take', () => {
    const values = [0, 0.4, 0.99, 0.7, 0, 0, 0.99, 0.99]
    const f = fixture(() => values.shift()!)
    const chosen: string[] = []
    for (let i = 0; i < 8; i++) {
      f.voice.play()
      chosen.push(f.player.src)
    }
    expect(new Set(chosen)).toEqual(new Set(HARVESTER_SELECTION_VOICES))
    for (let i = 1; i < chosen.length; i++)
      expect(chosen[i]).not.toBe(chosen[i - 1])
  })
  it('reuses one channel and replaces the previous voice from the beginning', () => {
    const f = fixture()
    f.voice.play()
    f.player.currentTime = 0.6
    f.voice.play()
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.player.pause).toHaveBeenCalledTimes(2)
    expect(f.player.play).toHaveBeenCalledTimes(2)
    expect(f.player.currentTime).toBe(0)
    expect(f.player.volume).toBe(0.75)
    f.voice.stop()
    expect(f.player.pause).toHaveBeenCalledTimes(3)
  })
  it('handles denied or interrupted playback and allows the next selection to retry', async () => {
    const f = fixture()
    f.player.play.mockRejectedValueOnce(
      new DOMException('Playback denied', 'NotAllowedError'),
    )
    f.voice.play()
    await Promise.resolve()
    f.voice.play()
    await Promise.resolve()
    expect(f.player.play).toHaveBeenCalledTimes(2)
  })
  it('stays silent during startup and acknowledges explicit reselection and focus only', () => {
    const f = fixture(),
      game = new GameRuntime(f.voice)
    f.voice.stop()
    expect(f.create).not.toHaveBeenCalled()
    game.ui.setState({ selectedId: null })
    expect(f.player.play).not.toHaveBeenCalled()
    game.selectUnit('harvester-01')
    game.selectUnit('harvester-01')
    game.selectUnit('harvester-02')
    game.focusUnit('harvester-02')
    expect(game.ui.getState().selectedId).toBe('harvester-02')
    expect(f.player.play).toHaveBeenCalledTimes(4)
    game.selectUnit('missing')
    expect(f.player.play).toHaveBeenCalledTimes(4)
  })
})

describe('movement order acknowledgements', () => {
  it('includes all six distinct, readable user-supplied MP3s', () => {
    const files = HARVESTER_MOVE_VOICES.map((path) =>
      readFileSync(
        fileURLToPath(new URL(`../../public${path}`, import.meta.url)),
      ),
    )
    expect(files).toHaveLength(6)
    expect(new Set(files.map((file) => file.toString('base64'))).size).toBe(6)
    for (const file of files) {
      expect(file.subarray(0, 3).toString()).toBe('ID3')
      expect(file.length).toBeGreaterThan(1000)
    }
  })
  it('uses every movement take with no consecutive repeats in that pool', () => {
    const values = [0, 0, 0.21, 0.41, 0.61, 0.81, 0, 0.99]
    const f = fixture(() => values.shift()!)
    const chosen: string[] = []
    for (let i = 0; i < 8; i++) {
      f.voice.play('move')
      chosen.push(f.player.src)
    }
    expect(new Set(chosen)).toEqual(new Set(HARVESTER_MOVE_VOICES))
    for (let i = 1; i < chosen.length; i++)
      expect(chosen[i]).not.toBe(chosen[i - 1])
  })
  it('shares one non-overlapping channel with selection, with separate random history', () => {
    const f = fixture()
    f.voice.play('selection')
    const firstSelection = f.player.src
    f.voice.play('move')
    const firstMove = f.player.src
    f.voice.play('selection')
    expect(f.player.src).not.toBe(firstSelection)
    f.voice.play('move')
    expect(f.player.src).not.toBe(firstMove)
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.player.pause).toHaveBeenCalledTimes(4)
    expect(f.player.play).toHaveBeenCalledTimes(4)
  })
  it('acknowledges only accepted moves for the selected unit at tick boundaries', () => {
    const f = fixture(),
      game = new GameRuntime(f.voice)
    game.ui.setState({ ready: true })
    game.selectUnit('harvester-02')
    const [a, b] = game.world.units,
      before = { ...b.position }
    expect(game.moveSelected({ x: 26, z: 35 }).accepted).toBe(true)
    expect(f.player.src).toBe(HARVESTER_MOVE_VOICES[0])
    expect(b.position).toEqual(before)
    expect(b.autonomous).toBe(true)
    game.simulation.step(0.05)
    expect(b.state).toBe('MOVE')
    expect(b.autonomous).toBe(false)
    expect(a.autonomous).toBe(true)
    expect(game.ui.getState().selectedId).toBe(b.id)
    const count = f.player.play.mock.calls.length
    expect(game.moveSelected({ x: 22, z: 27 }).accepted).toBe(false)
    expect(f.player.play).toHaveBeenCalledTimes(count)
    expect(game.ui.getState().moveFeedback?.accepted).toBe(false)
    game.ui.setState({ selectedId: null })
    expect(game.moveSelected({ x: 26, z: 35 }).accepted).toBe(false)
    expect(f.player.play).toHaveBeenCalledTimes(count)
  })
  it('uses the existing order pool for contextual harvesting, unloading and tank movement, keeping rejected orders silent', () => {
    const f = fixture(),
      game = new GameRuntime(f.voice)
    game.ui.setState({ ready: true })
    const w = game.world,
      h = w.units[0],
      d = w.deposits[2],
      p = w.grid.gridToWorld(d.cell)
    expect(
      game.orderSelected({ kind: 'deposit', id: d.id, cell: d.cell }, p)
        .accepted,
    ).toBe(true)
    expect(f.player.play).toHaveBeenCalledTimes(1)
    expect(h.targetId).toBeUndefined()
    game.simulation.step(0.05)
    expect(h.targetId).toBe(d.id)
    h.cargo = 10
    expect(
      game.orderSelected(
        { kind: 'refinery', id: w.refinery!.id, cell: { x: 23, z: 28 } },
        w.refineryPosition,
      ).accepted,
    ).toBe(true)
    expect(f.player.play).toHaveBeenCalledTimes(2)
    game.selectUnit(w.tanks[0].id)
    const count = f.player.play.mock.calls.length
    expect(
      game.orderSelected({ kind: 'deposit', id: d.id, cell: d.cell }, p)
        .accepted,
    ).toBe(false)
    expect(
      game.orderSelected(
        { kind: 'refinery', id: w.refinery!.id, cell: { x: 23, z: 28 } },
        w.refineryPosition,
      ).accepted,
    ).toBe(false)
    expect(f.player.play).toHaveBeenCalledTimes(count)
    const cell = { x: 21, z: 16 }
    expect(
      game.orderSelected({ kind: 'ground', cell }, w.grid.gridToWorld(cell))
        .accepted,
    ).toBe(true)
    expect(f.player.play).toHaveBeenCalledTimes(count + 1)
    expect(HARVESTER_MOVE_VOICES).toContain(f.player.src)
  })
})
