import { useGame, useUI } from '../app/GameContext'
import type { PostProcessingSettings } from '../app/runtime'
import { Icon } from './Icon'

export function DeveloperPanel() {
  const game = useGame(),
    open = useUI((s) => s.developerOpen)
  const state = useUI((s) => s)
  if (!open) return null
  const setEffect = (
    key: keyof PostProcessingSettings,
    value: number | boolean,
  ) => game.ui.setState((s) => ({ effects: { ...s.effects, [key]: value } }))
  return (
    <section className="developer-panel panel" aria-label="Field controls">
      <div className="panel-topline">
        <span className="eyebrow">FIELD CONTROLS</span>
        <button
          className="icon-button small"
          aria-label="Close field controls"
          onClick={() => game.ui.setState({ developerOpen: false })}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <label className="toggle-row">
        <span>
          Navigation grid <kbd>G</kbd>
        </span>
        <input
          type="checkbox"
          checked={state.showGrid}
          onChange={(e) => game.ui.setState({ showGrid: e.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>
          Active route <kbd>P</kbd>
        </span>
        <input
          type="checkbox"
          checked={state.showPaths}
          onChange={(e) => game.ui.setState({ showPaths: e.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>Postprocessing</span>
        <input
          type="checkbox"
          checked={state.effects.enabled}
          onChange={(e) => setEffect('enabled', e.target.checked)}
        />
      </label>
      <div className="range-fields">
        <label>
          Film grain <span>{state.effects.grainIntensity.toFixed(3)}</span>
          <input
            aria-label="Film grain"
            type="range"
            min="0"
            max="0.12"
            step="0.005"
            value={state.effects.grainIntensity}
            onChange={(e) =>
              setEffect('grainIntensity', Number(e.target.value))
            }
          />
        </label>
        <label>
          Chromatic edges{' '}
          <span>{state.effects.chromaticAberrationIntensity.toFixed(4)}</span>
          <input
            aria-label="Chromatic edges"
            type="range"
            min="0"
            max="0.003"
            step="0.0001"
            value={state.effects.chromaticAberrationIntensity}
            onChange={(e) =>
              setEffect('chromaticAberrationIntensity', Number(e.target.value))
            }
          />
        </label>
        <label>
          Vignette <span>{state.effects.vignetteIntensity.toFixed(2)}</span>
          <input
            aria-label="Vignette"
            type="range"
            min="0"
            max="0.6"
            step="0.02"
            value={state.effects.vignetteIntensity}
            onChange={(e) =>
              setEffect('vignetteIntensity', Number(e.target.value))
            }
          />
        </label>
      </div>
      <div className="debug-readout">
        <span>SIMULATION</span>
        <span>20 HZ / {state.view.fps} FPS</span>
        <span>STATE</span>
        <span>{state.view.state}</span>
        <span>DEPOSITS</span>
        <span>{Math.ceil(state.view.remaining).toLocaleString('en-US')} M</span>
      </div>
      <p className="dev-note">
        Fixed-step simulation · Blender-authored world
        <br />
        No combat. Just an honest day's work.
      </p>
    </section>
  )
}
