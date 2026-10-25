export const MUSIC_PLAYLIST = [
  { title: 'Desert Machine Uprising', file: 'desert-machine-uprising.mp3' },
  { title: 'Desert War Machine', file: 'desert-war-machine.mp3' },
  { title: 'Dust of the Ancients', file: 'dust-of-the-ancients.mp3' },
  { title: 'Dust Relic Circuit', file: 'dust-relic-circuit.mp3' },
  {
    title: 'Secrets Beneath the Dunes',
    variant: '01',
    file: 'secrets-beneath-the-dunes-01.mp3',
  },
  {
    title: 'Secrets Beneath the Dunes',
    variant: '02',
    file: 'secrets-beneath-the-dunes-02.mp3',
  },
  {
    title: 'Secrets Beneath the Dunes',
    variant: '03',
    file: 'secrets-beneath-the-dunes-03.mp3',
  },
] as const

export const musicTitle = (index: number) => {
  const track = MUSIC_PLAYLIST[index]
  return 'variant' in track ? `${track.title} · ${track.variant}` : track.title
}

export const musicUrl = (index: number) =>
  `/audio/music/${MUSIC_PLAYLIST[index].file}`
