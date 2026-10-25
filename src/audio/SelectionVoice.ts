export const HARVESTER_SELECTION_VOICES = [
  '/audio/voices/harvester/selection/yes-sir-01.mp3',
  '/audio/voices/harvester/selection/yes-sir-02.mp3',
  '/audio/voices/harvester/selection/yes-sir-03.mp3',
  '/audio/voices/harvester/selection/yes-sir-04.mp3',
] as const

type VoicePlayer = Pick<
  HTMLAudioElement,
  'src' | 'preload' | 'volume' | 'currentTime' | 'pause' | 'play'
>

/** One presentation-only voice channel, shared by both harvesters. */
export class SelectionVoice {
  private player?: VoicePlayer
  private lastIndex = -1

  constructor(
    private createPlayer: () => VoicePlayer = () => new Audio(),
    private random: () => number = Math.random,
  ) {}

  play(): void {
    const count = HARVESTER_SELECTION_VOICES.length
    let index = Math.floor(
      this.random() * (this.lastIndex < 0 ? count : count - 1),
    )
    if (this.lastIndex >= 0 && index >= this.lastIndex) index++
    this.lastIndex = index

    // Lazily create the player: startup remains silent and needs no autoplay permission.
    const player = (this.player ??= this.createPlayer())
    player.pause()
    player.src = HARVESTER_SELECTION_VOICES[index]
    player.currentTime = 0
    player.preload = 'auto'
    player.volume = 0.75
    // Call synchronously from the user's input handler to preserve browser activation.
    void player.play().catch(() => {
      // A blocked, interrupted, or unavailable voice must not interrupt selection.
      // The next explicit selection can try again; never queue deferred acknowledgements.
    })
  }

  stop(): void {
    if (!this.player) return
    this.player.pause()
    this.player.currentTime = 0
  }
}
