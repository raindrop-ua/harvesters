import { useEffect } from 'react'
import { useGame, useUI } from '../app/GameContext'
import type { HarvesterState } from '../game/types'
import { DeveloperPanel } from './DeveloperPanel'
import { MiniMap } from './MiniMap'
import { Icon } from './Icon'
import { MusicControls } from './MusicControls'

const labels: Record<HarvesterState, string> = {
  IDLE: 'Standing by',
  FIND_RESOURCE: 'Finding minerals',
  MOVE_TO_RESOURCE: 'Heading to deposit',
  HARVEST: 'Harvesting minerals',
  CARGO_FULL: 'Cargo secured',
  MOVE_TO_QUEUE: 'Heading to waiting bay',
  WAIT_FOR_DOCK: 'Waiting for refinery',
  UNDOCK: 'Reversing out',
  LEAVE_REFINERY: 'Clearing the approach',
  MOVE_TO_REFINERY: 'Returning to refinery',
  DOCK: 'Docking at K-01',
  UNLOAD: 'Unloading cargo',
  MOVE: 'Following orders',
  STOPPED: 'Standing by',
}
function clock(time: number) {
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`
}

export function HUD() {
  const game = useGame(),
    view = useUI((s) => s.view),
    selectedId = useUI((s) => s.selectedId)
  const selected = view.units.find((u) => u.id === selectedId)
  const unit = selected ?? view.units[0]
  const paused = useUI((s) => s.paused),
    speed = useUI((s) => s.speed),
    developerOpen = useUI((s) => s.developerOpen)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.repeat
      )
        return
      if (
        event.code === 'Space' &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault()
        game.ui.setState((s) => ({ paused: !s.paused }))
      }
      if (event.code === 'KeyF') game.focusUnit()
      if (event.code === 'KeyG')
        game.ui.setState((s) => ({ showGrid: !s.showGrid }))
      if (event.code === 'KeyP')
        game.ui.setState((s) => ({ showPaths: !s.showPaths }))
      if (event.code === 'Escape')
        game.ui.setState({ selectedId: null, developerOpen: false })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [game])

  const moving = [
    'MOVE_TO_RESOURCE',
    'MOVE_TO_QUEUE',
    'MOVE_TO_REFINERY',
    'UNDOCK',
    'LEAVE_REFINERY',
    'MOVE',
  ].includes(unit.state)
  const progress = (unit.cargo / unit.capacity) * 100
  return (
    <div className="hud">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="compass" size={26} />
          </div>
          <div>
            <h1>
              HARVESTER<span className="version">0.1</span>
            </h1>
            <p>AN OUTPOST ON THE EDGE</p>
          </div>
        </div>
        <div className="mission-tag">
          <span className={`live-dot ${paused ? 'is-paused' : ''}`} />
          <span>{paused ? 'SIMULATION PAUSED' : 'DESERT OPERATIONS'}</span>
          <span className="mission-divider">/</span>
          <time>{clock(view.time)}</time>
        </div>
        <div className="topbar-right">
          <div className="resource-counter">
            <Icon name="crystal" size={27} />
            <div>
              <span className="eyebrow">REFINED MINERALS</span>
              <strong data-testid="balance">
                {Math.floor(view.balance + 1e-6).toLocaleString('en-US')}
                <span>M</span>
              </strong>
            </div>
          </div>
          <div className="top-controls">
            <button
              className="icon-button"
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              title="Pause / resume (Space)"
              onClick={() => game.ui.setState({ paused: !paused })}
            >
              <Icon name={paused ? 'play' : 'pause'} size={18} />
            </button>
            <button
              className="speed-button"
              aria-label={`Simulation speed ${speed}x`}
              onClick={() =>
                game.ui.setState({
                  speed: speed === 1 ? 2 : speed === 2 ? 4 : 1,
                })
              }
            >
              {speed}×
            </button>
            <button
              className={`icon-button ${developerOpen ? 'active' : ''}`}
              aria-label="Open field controls"
              aria-expanded={developerOpen}
              onClick={() =>
                game.ui.setState({ developerOpen: !developerOpen })
              }
            >
              <Icon name="settings" size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="sector-label">
        <span className="coordinate-mark">+</span>
        <div>
          <span>K—01</span>
          <small>SOUTHERN BASIN / 07</small>
        </div>
      </div>
      <div className="dock-status" data-testid="dock-status">
        <span className={`live-dot ${view.dockOwner ? 'is-paused' : ''}`} />
        <span>
          {view.dockOwner
            ? `K-01 · H-${view.dockOwner.slice(-2)} in port`
            : 'K-01 · dock clear'}
        </span>
        {view.queue.filter((id) => id !== view.dockOwner).length > 0 && (
          <b>
            {view.queue.filter((id) => id !== view.dockOwner).length} WAITING
          </b>
        )}
      </div>
      {paused && (
        <div className="paused-banner">
          <Icon name="pause" size={15} /> Time stands still{' '}
          <span>SPACE TO RESUME</span>
        </div>
      )}
      <DeveloperPanel />
      <MusicControls />

      <footer className="bottom-hud">
        <div className="unit-area">
          <div className="fleet-switcher" aria-label="Harvester fleet">
            {view.units.map((u) => (
              <button
                key={u.id}
                aria-label={`Select harvester H-${u.id.slice(-2)}`}
                aria-pressed={selectedId === u.id}
                onClick={() => game.selectUnit(u.id)}
              >
                <span
                  className={`live-dot ${u.state === 'WAIT_FOR_DOCK' ? 'is-paused' : ''}`}
                />
                <b>H-{u.id.slice(-2)}</b>
                <span>{Math.floor(u.cargo + 1e-6)} M</span>
              </button>
            ))}
          </div>
          {selected ? (
            <section
              className="unit-card panel"
              aria-label="Selected harvester"
            >
              <div className="panel-topline">
                <span className="eyebrow">
                  <span className="tiny-square" /> UNIT {unit.id.slice(-2)} ·
                  INDUSTRIAL
                </span>
                <button
                  className="icon-button small"
                  aria-label="Deselect harvester"
                  onClick={() => game.ui.setState({ selectedId: null })}
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
              <div className="unit-heading">
                <div>
                  <h2>The workhorse.</h2>
                  <p>H-{unit.id.slice(-2)} TRACKED HARVESTER</p>
                </div>
                <div className="unit-emblem">
                  <Icon name="tractor" size={32} />
                </div>
              </div>
              <div className="unit-state">
                <span
                  className={`live-dot ${unit.state === 'STOPPED' ? 'is-paused' : ''}`}
                />
                <span data-testid="unit-state">{labels[unit.state]}</span>
                <span className="state-wave">
                  {moving ? '↗' : unit.state === 'HARVEST' ? '⟐' : '—'}
                </span>
              </div>
              <p className="unit-message" data-testid="unit-message">
                {unit.message}
              </p>
              <div className="cargo-label">
                <span>CARGO BAY</span>
                <span>
                  <b data-testid="cargo">{Math.floor(unit.cargo + 1e-6)}</b> /{' '}
                  {unit.capacity} M
                </span>
              </div>
              <div
                className="cargo-track"
                role="progressbar"
                aria-label="Harvester cargo"
                aria-valuemin={0}
                aria-valuemax={unit.capacity}
                aria-valuenow={Math.floor(unit.cargo + 1e-6)}
              >
                <div style={{ width: `${progress}%` }} />
              </div>
              <div className="unit-actions">
                <button onClick={() => game.focusUnit()} title="Focus unit (F)">
                  <Icon name="focus" size={15} /> Locate <kbd>F</kbd>
                </button>
                <button
                  onClick={() =>
                    game.command(unit.state === 'STOPPED' ? 'AUTO' : 'STOP')
                  }
                >
                  <Icon
                    name={unit.state === 'STOPPED' ? 'play' : 'pause'}
                    size={13}
                  />
                  {unit.state === 'STOPPED' ? 'Autopilot' : 'Hold'}
                </button>
                <button
                  onClick={() => game.command('RETURN_CARGO')}
                  aria-label="Return cargo to refinery"
                  title="Return cargo"
                >
                  <Icon name="return" size={15} />
                </button>
              </div>
            </section>
          ) : (
            <button
              className="select-unit panel"
              onClick={() => game.focusUnit()}
            >
              <Icon name="tractor" />
              <span>
                Select harvester <kbd>F</kbd>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          )}
          <div className="build-stamp">
            <span className="stamp-dot" /> VERTICAL SLICE{' '}
            <span>01 / A QUIET INDUSTRY</span>
          </div>
        </div>

        <div className="field-notes">
          <span className="eyebrow">THE SHIFT CONTINUES</span>
          <p>
            A small crew.
            <br />
            <em>A vast desert.</em>
          </p>
          <div>
            <span>{String(view.deliveries).padStart(2, '0')}</span> DELIVERIES
            COMPLETED
          </div>
        </div>

        <div className="map-area">
          <MiniMap />
          <div className="camera-hints">
            <span>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> PAN
            </span>
            <span className="wheel-icon">↕</span>
            <span>SCROLL TO ZOOM</span>
          </div>
        </div>
      </footer>
      <div className="screen-reader-status" role="status" aria-live="polite">
        {paused ? 'Simulation paused.' : ''} {labels[unit.state]}.{' '}
        {view.deliveries} deliveries completed.
      </div>
    </div>
  )
}
