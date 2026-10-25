import { useEffect } from 'react'
import { useGame, useUI } from '../app/GameContext'
import { Icon } from './Icon'
import './MoveFeedback.css'

export function MoveFeedback() {
  const game = useGame(),
    feedback = useUI((s) => s.moveFeedback),
    selectedId = useUI((s) => s.selectedId)
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(
      () => {
        if (game.ui.getState().moveFeedback?.sequence === feedback.sequence)
          game.ui.setState({ moveFeedback: null })
      },
      feedback.accepted ? 1500 : 1100,
    )
    return () => window.clearTimeout(timer)
  }, [feedback, game])
  if (!feedback || feedback.unitId !== selectedId) return null
  const unit = game.world.vehicles.find((u) => u.id === selectedId)
  const callsign =
    unit?.kind === 'tank'
      ? `${unit.tankClass[0].toUpperCase()}T`
      : `H-${feedback.unitId.slice(-2)}`
  const order =
    feedback.order === 'HARVEST'
      ? 'HARVEST'
      : feedback.order === 'RETURN_CARGO'
        ? 'UNLOAD'
        : 'MOVE'
  return (
    <div
      className="projected-label"
      ref={(element) => {
        if (element) game.labelElements.set('move-feedback', element)
        else game.labelElements.delete('move-feedback')
      }}
    >
      <div
        key={feedback.sequence}
        className={`move-feedback ${feedback.accepted ? 'is-accepted' : 'is-rejected'}`}
        data-testid="move-feedback"
        data-accepted={feedback.accepted}
        role="status"
      >
        <Icon name={feedback.accepted ? 'focus' : 'close'} size={36} />
        <small>
          {feedback.accepted ? `${order} · ${callsign}` : feedback.reason}
        </small>
      </div>
    </div>
  )
}
