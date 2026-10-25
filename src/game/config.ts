export const config = {
  tickRate: 20,
  maxCatchUpSteps: 8,
  harvester: {
    capacity: 120,
    harvestRate: 16,
    unloadRate: 40,
    speed: 5.2,
    acceleration: 5,
    turnSpeed: 2.8,
    harvestingRadius: 5.8,
    minimumHarvestDistance: 4.2,
    dockingTime: 0.8,
    retryInterval: 2,
  },
  camera: {
    elevation: 55,
    azimuth: 40,
    speed: 30,
    minZoom: 8,
    maxZoom: 32,
    initialZoom: 17,
    bounds: 45,
    smoothing: 8,
  },
  effects: {
    enabled: true,
    grainIntensity: 0.025,
    chromaticAberrationIntensity: 0.00045,
    vignetteIntensity: 0.24,
  },
} as const

export type HarvesterConfig = { [K in keyof typeof config.harvester]: number }
