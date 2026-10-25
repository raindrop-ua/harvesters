import {
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useUI } from '../../app/GameContext'

export function SceneEffects() {
  const settings = useUI((s) => s.effects)
  if (!settings.enabled) return null
  return (
    <EffectComposer multisampling={2} enableNormalPass={false}>
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
