export const config = {
  tickRate: 20,
  maxCatchUpSteps: 8,
  minerals: {
    regenerationRate: 0.2, // 12 M per simulation minute per resting field.
    minimumDispatchAmount: 24,
  },
  harvester: {
    capacity: 120,
    harvestRate: 16,
    unloadRate: 20,
    speed: 5.2,
    acceleration: 5,
    turnSpeed: 2.8,
    harvestingRadius: 5.8,
    minimumHarvestDistance: 4.2,
    dockingTime: 0.8,
    retryInterval: 2,
    unitSeparation: 6.4,
    dockingPositionTolerance: 0.08,
    dockingAngleTolerance: 0.025,
    busyDepositPenalty: 18,
  },
  tanks: {
    light: {
      name: 'Sand scout',
      speed: 7.2,
      acceleration: 6,
      turnSpeed: 3.2,
      turretSpeed: 0.65,
    },
    medium: {
      name: 'Dune ranger',
      speed: 5.6,
      acceleration: 4.5,
      turnSpeed: 2.4,
      turretSpeed: 0.5,
    },
    heavy: {
      name: 'Basin sentinel',
      speed: 4,
      acceleration: 3,
      turnSpeed: 1.8,
      turretSpeed: 0.38,
    },
  },
  camera: {
    initialFocus: { x: -12, z: -3 },
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
export type MineralConfig = { [K in keyof typeof config.minerals]: number }
