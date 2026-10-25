import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { GameRuntime, UIState } from './runtime'

export const GameContext = createContext<GameRuntime | null>(null)
export function useGame(): GameRuntime {
  const game = useContext(GameContext)
  if (!game) throw new Error('Game provider missing')
  return game
}
export function useUI<T>(selector: (state: UIState) => T): T {
  return useStore(useGame().ui, selector)
}
