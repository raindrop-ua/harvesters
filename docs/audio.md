# Game audio

## Background music

Seven user-supplied MP3s are grouped in `public/audio/music/`. Filenames retain the track names in lowercase kebab case, without export timestamps. The three exports named **Secrets Beneath the Dunes** keep their shared title and use numbered variants rather than invented track names.

Playlist order and source mapping:

| Asset                              | Original export                                       |
| ---------------------------------- | ----------------------------------------------------- |
| `desert-machine-uprising.mp3`      | `Desert_Machine_Uprising_2026-10-25T041349.mp3`       |
| `desert-war-machine.mp3`           | `Desert_War_Machine_2026-10-25T041349.mp3`            |
| `dust-of-the-ancients.mp3`         | `Dust_Of_The_Ancients_2026-10-25T040930.mp3`          |
| `dust-relic-circuit.mp3`           | `Dust_Relic_Circuit_2026-10-25T040930.mp3`            |
| `secrets-beneath-the-dunes-01.mp3` | `Secrets_Beneath_the_Dunes_2026-10-25T040353.mp3`     |
| `secrets-beneath-the-dunes-02.mp3` | `Secrets_Beneath_the_Dunes_2026-10-25T040353 (1).mp3` |
| `secrets-beneath-the-dunes-03.mp3` | `Secrets_Beneath_the_Dunes_2026-10-25T041044.mp3`     |

Each track runs for approximately two minutes, giving about 14 minutes per playlist cycle. Original MP3 data is preserved without transcoding; the source Downloads files are unchanged.

`src/audio/musicPlaylist.ts` owns the ordered titles and asset URLs. `src/audio/BackgroundMusic.ts` plays one track at a time and advances on the native `ended` event, returning to the first track after the seventh. Only the current track is loaded. Playback starts after the first pointer or keyboard action, or the radio's Play button, to respect browser media activation rules.

The compact **FIELD RADIO** panel shows the current title and provides Play/Pause, Next, volume, and a selectable playlist. Default music volume is 25%. Next preserves an intentional pause; choosing a song from the playlist starts it. Simulation pause and speed do not affect music. Hidden tabs pause playback; returning resumes the same track from its previous position unless the user paused it.

Music and unit voices use separate channels, so selecting a unit does not interrupt a track. A failed track is skipped; failures are bounded to one playlist pass, with explicit Play available to retry. Browser activation rejection waits for another user action. Cleanup pauses audio and removes listeners.

## Unit voices

Harvester selection uses four user-supplied ElevenLabs takes of **“Yes sir!”**, generated with **Morgan — Deep, Powerful, and Confident**. Original MP3 data is preserved; the files are copied and renamed, without transcoding or modifying the source Downloads files.

Runtime assets are grouped in `public/audio/voices/harvester/selection/`:

| Asset            | Original ElevenLabs export                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `yes-sir-01.mp3` | `ElevenLabs_2026-10-25T03_54_08_Morgan - Deep, Powerful, and Confident_pvc_sp100_s50_sb75_v4.mp3`     |
| `yes-sir-02.mp3` | `ElevenLabs_2026-10-25T03_54_08_Morgan - Deep, Powerful, and Confident_pvc_sp100_s50_sb75_v4 (1).mp3` |
| `yes-sir-03.mp3` | `ElevenLabs_2026-10-25T03_54_41_Morgan - Deep, Powerful, and Confident_pvc_sp100_s50_sb75_v4.mp3`     |
| `yes-sir-04.mp3` | `ElevenLabs_2026-10-25T03_54_41_Morgan - Deep, Powerful, and Confident_pvc_sp100_s50_sb75_v4 (1).mp3` |

`src/audio/SelectionVoice.ts` owns the voice pool and one reusable HTML audio channel. Each explicit selection chooses randomly from all takes except the immediately previous take. Selecting either 3D vehicle, using the H-01/H-02 buttons, or selecting/focusing through F, Locate, or the minimap plays one acknowledgement. Clicking the same unit again also acknowledges. The initially selected unit stays silent at startup.

Rapid selections replace the current voice; they do not overlap or build a backlog. Playback starts directly in the input handler, preserving browser user activation. Playback rejection does not prevent selection. Voices stop when the game is unmounted or its tab is hidden. Default volume is 75%.

All audio remains outside the deterministic simulation. Local MP3 assets are copied into `dist/audio/` by Vite and are included by the existing Docker `COPY public` workflow. No ElevenLabs account or API call is needed at runtime.
