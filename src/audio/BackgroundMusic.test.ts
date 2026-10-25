import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BackgroundMusic } from './BackgroundMusic'
import { MUSIC_PLAYLIST, musicTitle, musicUrl } from './musicPlaylist'

class FakeAudio extends EventTarget {
  src = ''
  preload: HTMLAudioElement['preload'] = 'none'
  volume = 1
  loop = true
  error: MediaError | null = null
  currentTime = 0
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
}
function fixture() {
  const player = new FakeAudio(),
    create = vi.fn(() => player)
  return { player, create, music: new BackgroundMusic(create) }
}
const settle = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve()
}

describe('background playlist', () => {
  it('contains all seven playable local assets with readable names and distinct variants', () => {
    expect(MUSIC_PLAYLIST).toHaveLength(7)
    expect(new Set(MUSIC_PLAYLIST.map((track) => track.file)).size).toBe(7)
    expect(musicTitle(0)).toBe('Desert Machine Uprising')
    expect(musicTitle(4)).toBe('Secrets Beneath the Dunes · 01')
    expect(musicTitle(6)).toBe('Secrets Beneath the Dunes · 03')
    for (let i = 0; i < MUSIC_PLAYLIST.length; i++) {
      const file = readFileSync(
        fileURLToPath(new URL(`../../public${musicUrl(i)}`, import.meta.url)),
      )
      expect(file.length).toBeGreaterThan(1000)
      expect(file.subarray(0, 3).toString()).toBe('ID3')
    }
  })
  it('stays silent until activated, then plays each track in order and wraps to the first', async () => {
    const f = fixture()
    expect(f.create).not.toHaveBeenCalled()
    f.music.activate()
    await settle()
    expect(f.player.loop).toBe(false)
    expect(f.player.volume).toBe(0.25)
    for (let i = 0; i < 7; i++) {
      expect(f.player.src).toBe(musicUrl(i))
      expect(f.music.state.getState().status).toBe('playing')
      f.player.dispatchEvent(new Event('ended'))
      await settle()
    }
    expect(f.player.src).toBe(musicUrl(0))
    expect(f.create).toHaveBeenCalledTimes(1)
  })
  it('respects explicit pause through game gestures, next, and tab visibility', async () => {
    const f = fixture()
    f.music.activate()
    await settle()
    f.player.currentTime = 38
    f.music.pause()
    f.music.activate()
    f.music.setHidden(true)
    f.music.setHidden(false)
    expect(f.player.play).toHaveBeenCalledTimes(1)
    f.music.next()
    expect(f.music.state.getState().trackIndex).toBe(1)
    expect(f.music.state.getState().status).toBe('paused')
    f.music.play()
    await settle()
    expect(f.player.src).toBe(musicUrl(1))
  })
  it('resumes the same track after hiding the tab without seeking back to zero', async () => {
    const f = fixture()
    f.music.activate()
    await settle()
    f.player.currentTime = 48
    f.music.setHidden(true)
    expect(f.music.state.getState().status).toBe('paused')
    f.music.setHidden(false)
    await settle()
    expect(f.music.state.getState().status).toBe('playing')
    expect(f.player.currentTime).toBe(48)
    expect(f.player.src).toBe(musicUrl(0))
  })
  it('starts an explicitly selected playlist track even when previously paused', async () => {
    const f = fixture()
    f.music.pause()
    f.music.select(5)
    await settle()
    expect(f.player.src).toBe(musicUrl(5))
    expect(f.music.state.getState().status).toBe('playing')
    f.music.select(-1)
    f.music.select(NaN)
    expect(f.music.state.getState().trackIndex).toBe(5)
  })
  it('does not let stale playback promises undo a pause or a track change', async () => {
    const f = fixture()
    let resolve!: () => void
    f.player.play.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done
        }),
    )
    f.music.activate()
    f.music.pause()
    resolve()
    await settle()
    expect(f.music.state.getState().status).toBe('paused')
    f.music.play()
    await settle()
    f.music.next()
    await settle()
    expect(f.music.state.getState().trackIndex).toBe(1)
  })
  it('retries blocked playback on the next gesture instead of skipping the track', async () => {
    const f = fixture()
    f.player.play.mockRejectedValueOnce(
      new DOMException('Denied', 'NotAllowedError'),
    )
    f.music.activate()
    await settle()
    expect(f.music.state.getState().status).toBe('blocked')
    expect(f.music.state.getState().trackIndex).toBe(0)
    f.music.activate()
    await settle()
    expect(f.music.state.getState().status).toBe('playing')
  })
  it('skips failed files and stops after one failed pass instead of retrying forever', async () => {
    const f = fixture()
    f.player.play.mockRejectedValue(
      new DOMException('Invalid media', 'NotSupportedError'),
    )
    f.music.activate()
    await settle()
    expect(f.player.play).toHaveBeenCalledTimes(7)
    expect(f.music.state.getState().status).toBe('error')
    f.music.activate()
    await settle()
    expect(f.player.play).toHaveBeenCalledTimes(7)
    f.player.play.mockResolvedValue()
    f.music.play()
    await settle()
    expect(f.music.state.getState().status).toBe('playing')
  })
  it('changes volume independently and stops listening when the runtime stops', async () => {
    const f = fixture()
    f.music.setVolume(0.4)
    f.music.activate()
    await settle()
    expect(f.player.volume).toBe(0.4)
    f.music.setVolume(10)
    expect(f.player.volume).toBe(1)
    f.music.setVolume(NaN)
    expect(f.player.volume).toBe(1)
    f.music.stop()
    f.player.dispatchEvent(new Event('ended'))
    expect(f.music.state.getState().trackIndex).toBe(0)
    expect(f.player.pause).toHaveBeenCalled()
  })
})
