import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { useGame } from '../app/GameContext'
import { layout } from '../game/simulation/World'
import {
  TerrainModel,
  RockModel,
  MineralModel,
  RefineryModel,
  HarvesterModel,
} from './entities/WorldModels'
import { RTSCamera } from './camera/RTSCamera'
import { Particles } from './effects/Particles'
import { SceneEffects } from './postprocessing/SceneEffects'
import { DebugOverlay } from './DebugOverlay'

function SceneReady() {
  const game = useGame()
  useEffect(() => {
    game.ui.setState({ ready: true })
    return () => game.ui.setState({ ready: false })
  }, [game])
  return null
}

export default function GameScene() {
  const game = useGame()
  return (
    <Canvas
      orthographic
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, 1.75]}
      camera={{ position: [60, 90, 65], zoom: 17, near: 0.1, far: 400 }}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      onPointerMissed={() => game.ui.setState({ selected: false })}
    >
      <color attach="background" args={['#cba371']} />
      <fog attach="fog" args={['#d6b17c', 145, 250]} />
      <hemisphereLight args={['#e3f4e8', '#9c663c', 2.2]} />
      <directionalLight
        position={[-32, 55, 25]}
        intensity={3.4}
        color="#fff0c9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.06}
        shadow-camera-left={-52}
        shadow-camera-right={52}
        shadow-camera-top={52}
        shadow-camera-bottom={-52}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-radius={3}
      />
      <RTSCamera />
      <Suspense fallback={null}>
        <TerrainModel />
        {layout.rocks.map((_, i) => (
          <RockModel key={i} index={i} />
        ))}
        {game.world.deposits.map((deposit) => (
          <MineralModel key={deposit.id} deposit={deposit} />
        ))}
        <RefineryModel />
        <HarvesterModel />
        <Particles />
        <DebugOverlay />
        <SceneEffects />
        <SceneReady />
      </Suspense>
    </Canvas>
  )
}
