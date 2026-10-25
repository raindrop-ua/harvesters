import { useGame, useUI } from '../app/GameContext'
import { layout } from '../game/simulation/World'

export function MiniMap() {
  const game = useGame(),
    position = useUI((s) => s.view.position)
  const map = (v: number) => ((v + 64) / 128) * 160
  return (
    <button
      className="minimap"
      aria-label="Focus camera on harvester"
      onClick={() => game.focusUnit()}
      title="Focus harvester (F)"
    >
      <div className="minimap-heading">
        <span>SECTOR 07</span>
        <span className="map-cross">+</span>
      </div>
      <svg
        viewBox="0 0 160 112"
        role="img"
        aria-label="Sector map with refinery, deposits and harvester"
      >
        <defs>
          <pattern
            id="map-grid"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 16 0 L 0 0 0 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.4"
              opacity="0.14"
            />
          </pattern>
        </defs>
        <rect width="160" height="112" fill="url(#map-grid)" />
        <g transform="translate(0,-22)">
          <path
            d="M12 42Q18 9 44 24T75 34M7 49Q18 19 43 30T76 41M101 35q20-26 42-3m-46 9q30-28 49-1M84 126q16-27 47-11m-50 18q15-26 51-12M13 104q9-22 25-18m-31 25q13-25 35-18"
            fill="none"
            stroke="currentColor"
            opacity="0.15"
            strokeWidth="1"
          />
          {layout.rocks.map((r, i) => (
            <ellipse
              key={i}
              cx={map(r.x)}
              cy={map(r.z)}
              rx={r.scale * 2}
              ry={r.scale * 1.4}
              fill="currentColor"
              opacity="0.18"
            />
          ))}
          {game.world.deposits.map((d) => (
            <path
              key={d.id}
              d={`m${d.cell.x * 2.5} ${d.cell.z * 2.5 - 3} 2 3-2 3-2-3Z`}
              fill={d.amount > 0 ? '#72c7b8' : '#6c7862'}
            />
          ))}
          <rect
            x={map(-22)}
            y={map(-12)}
            width="15"
            height="12.5"
            fill="#d8c9a4"
          />
          <circle
            cx={map(position.x)}
            cy={map(position.z)}
            r="5"
            fill="none"
            stroke="#c3eed5"
            strokeWidth="0.7"
          />
          <circle
            cx={map(position.x)}
            cy={map(position.z)}
            r="2"
            fill="#eaf9db"
          />
        </g>
        <path
          d="M76 52h8m-4-4v8"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.3"
        />
      </svg>
      <div className="minimap-footer">
        <span>128 × 128 M</span>
        <span>N ↑</span>
      </div>
    </button>
  )
}
