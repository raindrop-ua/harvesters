export const HARVESTER_SELECTION_VOICES = [
  '/audio/voices/harvester/selection/yes-sir-01.mp3',
  '/audio/voices/harvester/selection/yes-sir-02.mp3',
  '/audio/voices/harvester/selection/yes-sir-03.mp3',
  '/audio/voices/harvester/selection/yes-sir-04.mp3',
] as const

export const HARVESTER_MOVE_VOICES = [
  '/audio/voices/harvester/orders/move-order-01.mp3',
  '/audio/voices/harvester/orders/move-order-02.mp3',
  '/audio/voices/harvester/orders/move-order-03.mp3',
  '/audio/voices/harvester/orders/move-order-04.mp3',
  '/audio/voices/harvester/orders/move-order-05.mp3',
  '/audio/voices/harvester/orders/move-order-06.mp3',
] as const

type VoiceKind = 'selection' | 'move'

type VoicePlayer = Pick<
  HTMLAudioElement,
  'src' | 'preload' | 'volume' | 'currentTime' | 'pause' | 'play'
>

/** One presentation-only voice channel, shared by both harvesters. */
export class HarvesterVoice {
  private player?: VoicePlayer
  private lastIndex: Record<VoiceKind, number> = { selection: -1, move: -1 }

  constructor(
    private createPlayer: () => VoicePlayer = () => new Audio(),
    private random: () => number = Math.random,
  ) {}

  play(kind: VoiceKind = 'selection'): void {
    const voices =
      kind === 'selection' ? HARVESTER_SELECTION_VOICES : HARVESTER_MOVE_VOICES
    const count = voices.length,
      lastIndex = this.lastIndex[kind]
    let index = Math.floor(this.random() * (lastIndex < 0 ? count : count - 1))
    if (lastIndex >= 0 && index >= lastIndex) index++
    this.lastIndex[kind] = index

    // Lazily create the player: startup remains silent and needs no autoplay permission.
    const player = (this.player ??= this.createPlayer())
    player.pause()
    player.src = voices[index]
    player.currentTime = 0
    player.preload = 'auto'
    player.volume = 0.75
    // Call synchronously from the user's input handler to preserve browser activation.
    void player.play().catch(() => {
      // Audio failure must not interrupt input; never queue deferred acknowledgements.
    })
  }

  stop(): void {
    if (!this.player) return
    this.player.pause()
    this.player.currentTime = 0
  }
}
