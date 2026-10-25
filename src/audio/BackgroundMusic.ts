import { createStore } from 'zustand/vanilla'
import { MUSIC_PLAYLIST, musicUrl } from './musicPlaylist'

type MusicStatus =
  'ready' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error'
interface MusicState {
  trackIndex: number
  status: MusicStatus
  volume: number
}
type MusicMedia = Pick<
  HTMLAudioElement,
  | 'src'
  | 'preload'
  | 'loop'
  | 'volume'
  | 'play'
  | 'pause'
  | 'error'
  | 'addEventListener'
  | 'removeEventListener'
>

/** A separate music channel. Browser audio never enters the gameplay simulation. */
export class BackgroundMusic {
  readonly state = createStore<MusicState>(() => ({
    trackIndex: 0,
    status: 'ready',
    volume: 0.25,
  }))
  private player?: MusicMedia
  private loadedIndex = -1
  private wantsPlayback = true
  private activated = false
  private hidden = false
  private version = 0
  private failedTracks = new Set<number>()

  constructor(private createPlayer: () => MusicMedia = () => new Audio()) {}

  /** Call from a trusted pointer/key event, never automatically during mount. */
  activate(): void {
    this.activated = true
    if (
      this.wantsPlayback &&
      ['ready', 'blocked'].includes(this.state.getState().status)
    )
      this.playCurrent()
  }
  play(): void {
    this.activated = true
    this.wantsPlayback = true
    this.failedTracks.clear()
    this.playCurrent()
  }
  pause(): void {
    this.wantsPlayback = false
    this.version++
    this.player?.pause()
    this.state.setState({ status: 'paused' })
  }
  next(): void {
    this.activated = true
    this.failedTracks.clear()
    this.changeTrack(
      (this.state.getState().trackIndex + 1) % MUSIC_PLAYLIST.length,
    )
  }
  select(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= MUSIC_PLAYLIST.length)
      return
    this.activated = true
    this.wantsPlayback = true
    this.failedTracks.clear()
    this.changeTrack(index)
  }
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return
    const clamped = Math.max(0, Math.min(1, volume))
    if (this.player) this.player.volume = clamped
    this.state.setState({ volume: clamped })
  }
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return
    this.hidden = hidden
    if (hidden) {
      this.version++
      this.player?.pause()
      if (this.activated) this.state.setState({ status: 'paused' })
    } else if (this.activated && this.wantsPlayback) this.playCurrent()
  }
  stop(): void {
    this.version++
    if (this.player) {
      this.player.pause()
      this.player.removeEventListener('ended', this.onEnded)
      this.player.removeEventListener('error', this.onError)
    }
    this.player = undefined
    this.loadedIndex = -1
    this.activated = false
    this.state.setState({ status: this.wantsPlayback ? 'ready' : 'paused' })
  }

  private onEnded = () => {
    if (this.activated && this.wantsPlayback && !this.hidden)
      this.changeTrack(
        (this.state.getState().trackIndex + 1) % MUSIC_PLAYLIST.length,
      )
  }
  private onError = () => {
    if (
      this.player?.error &&
      this.activated &&
      this.wantsPlayback &&
      !this.hidden
    )
      this.failCurrent(this.version)
  }
  private changeTrack(index: number): void {
    this.version++
    this.player?.pause()
    this.state.setState({ trackIndex: index, status: 'paused' })
    // Force a fresh source even when the user explicitly reselects the current track.
    this.loadedIndex = -1
    if (this.wantsPlayback) this.playCurrent()
  }
  private playCurrent(): void {
    if (this.hidden || !this.activated) return
    const version = ++this.version
    if (!this.player) {
      this.player = this.createPlayer()
      this.player.preload = 'auto'
      // Loop the playlist via ended; looping the element would repeat just one track.
      this.player.loop = false
      this.player.addEventListener('ended', this.onEnded)
      this.player.addEventListener('error', this.onError)
    }
    const player = this.player,
      state = this.state.getState()
    if (this.loadedIndex !== state.trackIndex) {
      player.src = musicUrl(state.trackIndex)
      this.loadedIndex = state.trackIndex
    }
    player.volume = state.volume
    this.state.setState({ status: 'loading' })
    void player
      .play()
      .then(() => {
        if (version !== this.version) return
        this.failedTracks.clear()
        this.state.setState({ status: 'playing' })
      })
      .catch((error: unknown) => {
        if (version !== this.version) return
        const name = error instanceof Error ? error.name : ''
        if (name === 'NotAllowedError' || name === 'AbortError')
          this.state.setState({ status: 'blocked' })
        else this.failCurrent(version)
      })
  }
  private failCurrent(version: number): void {
    if (version !== this.version) return
    this.failedTracks.add(this.state.getState().trackIndex)
    if (this.failedTracks.size >= MUSIC_PLAYLIST.length) {
      this.version++
      this.wantsPlayback = false
      this.player?.pause()
      this.state.setState({ status: 'error' })
      return
    }
    let index = (this.state.getState().trackIndex + 1) % MUSIC_PLAYLIST.length
    while (this.failedTracks.has(index))
      index = (index + 1) % MUSIC_PLAYLIST.length
    this.changeTrack(index)
  }
}
