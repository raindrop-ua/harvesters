import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { GameContext } from './GameContext'
import { GameRuntime } from './runtime'
import { HUD } from '../ui/HUD'

const GameScene = lazy(() => import('../rendering/GameScene'))

class SceneBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Scene could not start', error, info)
  }
  render() {
    if (this.state.error)
      return (
        <div className="loading-screen">
          <strong>The outpost couldn't come online.</strong>
          <p>
            Check that WebGL 2 is available and the Blender exports exist in
            public/models.
          </p>
          <code>{this.state.error}</code>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      )
    return this.props.children
  }
}

export function App() {
  const [game] = useState(() => new GameRuntime())
  useEffect(() => game.start(), [game])
  return (
    <GameContext.Provider value={game}>
      <main className="game-shell" aria-label="Desert RTS game">
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="loading-screen">
                <span className="loading-mark">H.</span>
                <p>Bringing the outpost online…</p>
              </div>
            }
          >
            <GameScene />
          </Suspense>
        </SceneBoundary>
        <HUD />
      </main>
    </GameContext.Provider>
  )
}
