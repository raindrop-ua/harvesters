import { useState } from 'react'
import { useStore } from 'zustand'
import { useGame } from '../app/GameContext'
import { MUSIC_PLAYLIST, musicTitle } from '../audio/musicPlaylist'
import { Icon } from './Icon'
import './MusicControls.css'

export function MusicControls() {
  const { music } = useGame(),
    state = useStore(music.state)
  const [expanded, setExpanded] = useState(false)
  const active = state.status === 'playing' || state.status === 'loading'
  const status =
    state.status === 'ready'
      ? 'STARTS WITH YOUR FIRST ACTION'
      : state.status === 'blocked'
        ? 'PRESS PLAY TO LISTEN'
        : state.status === 'error'
          ? 'UNAVAILABLE · PRESS PLAY TO RETRY'
          : active
            ? 'NOW PLAYING'
            : 'PAUSED'
  return (
    <section
      className="music-controls panel"
      aria-label="Background music"
      data-music-controls
    >
      <div className="music-heading">
        <span>FIELD RADIO</span>
        <span>{status}</span>
      </div>
      <p
        className="music-title"
        data-testid="music-title"
        title={musicTitle(state.trackIndex)}
      >
        {musicTitle(state.trackIndex)}
      </p>
      <div className="music-actions">
        <button
          className="icon-button"
          aria-label={active ? 'Pause music' : 'Play music'}
          onClick={() => (active ? music.pause() : music.play())}
        >
          <Icon name={active ? 'pause' : 'play'} size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Next music track"
          onClick={() => music.next()}
        >
          <Icon name="next" size={15} />
        </button>
        <input
          type="range"
          aria-label="Music volume"
          min="0"
          max="100"
          step="1"
          value={Math.round(state.volume * 100)}
          onChange={(event) =>
            music.setVolume(Number(event.target.value) / 100)
          }
        />
        <button
          className="music-list-button"
          aria-label="Show music playlist"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {state.trackIndex + 1}/{MUSIC_PLAYLIST.length}
          <Icon name="playlist" size={15} />
        </button>
      </div>
      {expanded && (
        <ol className="music-playlist" aria-label="Music playlist">
          {MUSIC_PLAYLIST.map((track, index) => (
            <li key={track.file}>
              <button
                aria-label={`Play ${musicTitle(index)}`}
                aria-current={state.trackIndex === index ? 'true' : undefined}
                onClick={() => {
                  music.select(index)
                  setExpanded(false)
                }}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {musicTitle(index)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
