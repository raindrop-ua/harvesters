import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Mesh } from 'three'

export const MODEL_URLS = [
  'terrain',
  'refinery',
  'courtyard',
  'smoke',
  'harvester',
  'minerals',
  'rocks',
  'effects',
  'tank-light',
  'tank-medium',
  'tank-heavy',
].map((name) => `/models/${name}.glb`)
for (const url of MODEL_URLS) useGLTF.preload(url)

/** Clone hierarchy only; GPU geometry/materials remain shared between instances. */
export function useModel(name: string) {
  const { scene } = useGLTF(`/models/${name}.glb`)
  return useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = name !== 'terrain'
        object.receiveShadow = true
      }
    })
    return clone
  }, [scene, name])
}
