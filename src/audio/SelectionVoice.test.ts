import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GameRuntime } from '../app/runtime'
import { HARVESTER_SELECTION_VOICES, SelectionVoice } from './SelectionVoice'

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
  return { player, create, voice: new SelectionVoice(create, random) }
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
