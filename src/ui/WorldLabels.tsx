import { useGame, useUI } from '../app/GameContext'
import { mineralGrade } from '../rendering/entities/mineralVisuals'

/** One DOM tree for world labels; presentation refs are positioned by the canvas bridge. */
export function WorldLabels() {
  const game = useGame(),
    deposits = useUI((s) => s.view.deposits),
    selectedId = useUI((s) => s.selectedId),
    ready = useUI((s) => s.ready)
  const attach = (id: string, element: HTMLDivElement | null) => {
    if (element) game.labelElements.set(id, element)
    else game.labelElements.delete(id)
  }
  return (
    <div
      className="world-labels"
      aria-hidden={!ready}
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    >
      {game.world.units.map((unit) => (
        <div
          key={unit.id}
          className="projected-label"
          ref={(element) => attach(unit.id, element)}
        >
          <span
            className={`unit-world-label ${selectedId === unit.id ? 'is-selected' : ''}`}
            data-testid={`world-${unit.id}`}
          >
            H-{unit.id.slice(-2)}
          </span>
        </div>
      ))}
      {deposits.map((d) => (
        <div
          key={d.id}
          className="projected-label"
          ref={(element) => attach(d.id, element)}
        >
          <div
            className={`mineral-label ${d.fraction === 0 ? 'is-depleted' : ''}`}
            data-testid={`deposit-${d.id}`}
          >
            <div>
              <span>FIELD {d.id.slice(-2)}</span>
              <b>{Math.ceil(d.fraction * 100)}%</b>
            </div>
            <div
              className="mineral-meter"
              role="progressbar"
              aria-label={`Mineral field ${d.id.slice(-2)} remaining`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.ceil(d.fraction * 100)}
            >
              <i style={{ width: `${d.fraction * 100}%` }} />
            </div>
            <small>{mineralGrade(d.fraction)}</small>
          </div>
        </div>
      ))}
    </div>
  )
}
