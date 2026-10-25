import type { CSSProperties } from 'react'

export function Icon({
  name,
  size = 20,
  style,
}: {
  name:
    | 'crystal'
    | 'focus'
    | 'pause'
    | 'play'
    | 'settings'
    | 'close'
    | 'arrow'
    | 'tractor'
    | 'return'
    | 'compass'
  size?: number
  style?: CSSProperties
}) {
  const paths = {
    crystal: (
      <>
        <path d="m12 2 6 7-2 10-4 3-4-3-2-10Z" />
        <path d="m12 2 1 9-1 11M6 9l7 2 5-2" />
      </>
    ),
    focus: (
      <>
        <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" strokeWidth="3" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2.5" />
        <circle cx="15" cy="17" r="2.5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    return: <path d="m9 5-6 6 6 6M3 11h12a5 5 0 0 1 0 10" />,
    tractor: (
      <>
        <path d="M4 11h16v7H4zM7 11V6h7v5M3 19h18M16 9h3v2" />
        <circle cx="8" cy="16" r="1" />
        <circle cx="16" cy="16" r="1" />
      </>
    ),
    compass: (
      <>
        <path d="m12 2 8 18-8-4-8 4Z" />
        <path d="M12 2v14" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  )
}
