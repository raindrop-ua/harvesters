import {
  ChromaticAberration,
  EffectComposer,
  Noise,
  SelectiveBloom,
  Vignette,
} from '@react-three/postprocessing'
import type { RefObject } from 'react'
import type { Object3D } from 'three'
import { BlendFunction } from 'postprocessing'
import { useUI } from '../../app/GameContext'

export function SceneEffects({
  lights,
}: {
  lights: RefObject<Object3D | null>[]
}) {
  const settings = useUI((s) => s.effects)
  if (!settings.enabled) return null
  return (
    <EffectComposer multisampling={2} enableNormalPass={false}>
      <SelectiveBloom
        lights={lights}
        ignoreBackground
        mipmapBlur
        luminanceThreshold={0.35}
        luminanceSmoothing={0.2}
        intensity={0.5}
        radius={0.5}
        levels={4}
      />
      <Noise
        opacity={settings.grainIntensity}
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      <ChromaticAberration
        offset={[
          settings.chromaticAberrationIntensity,
          settings.chromaticAberrationIntensity,
        ]}
        radialModulation
        modulationOffset={0.5}
      />
      <Vignette
        eskil={false}
        offset={0.22}
        darkness={settings.vignetteIntensity}
      />
    </EffectComposer>
  )
}
