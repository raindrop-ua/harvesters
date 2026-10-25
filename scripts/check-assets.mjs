import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

function sceneBounds(json) {
  const bounds = new Box3()
  const visit = (index, parent) => {
    const node = json.nodes[index]
    const local = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new Vector3().fromArray(node.scale ?? [1, 1, 1]),
        )
    const world = new Matrix4().multiplyMatrices(parent, local)
    if (node.mesh !== undefined)
      for (const primitive of json.meshes[node.mesh].primitives) {
        const position = json.accessors[primitive.attributes.POSITION]
        bounds.union(
          new Box3(
            new Vector3().fromArray(position.min),
            new Vector3().fromArray(position.max),
          ).applyMatrix4(world),
        )
      }
    for (const child of node.children ?? []) visit(child, world)
  }
  for (const root of json.scenes[json.scene ?? 0].nodes)
    visit(root, new Matrix4())
  return bounds
}

const names = [
  'terrain',
  'harvester',
  'refinery',
  'courtyard',
  'smoke',
  'minerals',
  'rocks',
  'effects',
  'tank-light',
  'tank-medium',
  'tank-heavy',
]
for (const name of names) {
  assert(
    existsSync(`assets/blender/${name}.blend`),
    `Missing Blender source: ${name}`,
  )
  const file = readFileSync(`public/models/${name}.glb`)
  assert.equal(file.toString('ascii', 0, 4), 'glTF')
  assert.equal(file.readUInt32LE(4), 2)
  assert.equal(file.readUInt32LE(8), file.length)
  const json = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)))
  assert(
    (json.extras?.sourceGenerator ?? json.asset.generator).includes('Blender'),
    `${name} must be exported by Blender`,
  )
  assert(json.meshes.length > 0)
  const required = {
    refinery: ['ProcessingStructure', 'DockStatusLight', 'SmokeOutlet'],
    courtyard: [
      'CourtyardStructure',
      'GantryCrane',
      'SupplyStacks',
      'CommandAntenna',
    ],
    smoke: ['SmokeParticle'],
  }
  for (const node of required[name] ?? [])
    assert(
      json.nodes.some((n) => n.name === node),
      `${name}: missing ${node}`,
    )
  if (name.startsWith('tank-')) {
    for (const node of [
      'Hull',
      'LeftTrackAssembly',
      'RightTrackAssembly',
      'TurretYaw',
      'GunPitch',
      'Muzzle',
    ])
      assert(
        json.nodes.some((n) => n.name === node),
        `${name}: missing ${node}`,
      )
    const yaw = json.nodes.find((n) => n.name === 'TurretYaw')
    const pitchIndex = json.nodes.findIndex((n) => n.name === 'GunPitch')
    const muzzleIndex = json.nodes.findIndex((n) => n.name === 'Muzzle')
    assert(
      yaw.children?.includes(pitchIndex),
      `${name}: gun must rotate with turret`,
    )
    assert(
      json.nodes[pitchIndex].children?.includes(muzzleIndex),
      `${name}: muzzle must follow gun pitch`,
    )
    assert(
      Math.abs(yaw.translation[0]) < 0.001 &&
        Math.abs(yaw.translation[2]) < 0.001 &&
        yaw.translation[1] > 1,
      `${name}: turret origin must be at its authored turntable`,
    )
    assert(
      json.nodes[muzzleIndex].translation[2] > 2,
      `${name}: muzzle must point along local +Z`,
    )
  }
  if (name === 'courtyard') {
    const { courtyard, cellSize } = JSON.parse(
      readFileSync('assets/world.json', 'utf8'),
    )
    const bounds = sceneBounds(json)
    assert(
      bounds.min.x >= (-courtyard.width * cellSize) / 2 &&
        bounds.max.x <= (courtyard.width * cellSize) / 2 &&
        bounds.min.z >= (-courtyard.depth * cellSize) / 2 &&
        bounds.max.z <= (courtyard.depth * cellSize) / 2,
      'Courtyard geometry must fit its reserved navigation footprint',
    )
  }
  if (name === 'minerals') {
    for (let i = 0; i < 7; i++) {
      const node = `Crystal${String(i).padStart(2, '0')}`
      assert(
        json.nodes.some((n) => n.name === node),
        `Missing staged depletion node ${node}`,
      )
    }
  }
  if (name === 'harvester') {
    for (const node of [
      'MainChassis',
      'LeftTrackAssembly',
      'RightTrackAssembly',
      'MiningRotor',
      'CargoContainer',
      'CargoFill',
    ]) {
      assert(
        json.nodes.some((n) => n.name === node),
        `Missing animation node ${node}`,
      )
    }
  }
  if (name === 'terrain') {
    const terrain = JSON.parse(
      readFileSync('src/game/data/terrain.json', 'utf8'),
    )
    const node = json.nodes.find((n) => n.name === 'DesertHeightfield')
    const geometry = json.meshes[node.mesh]
    const heights = new Map()
    for (const primitive of geometry.primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION]
      const view = json.bufferViews[accessor.bufferView]
      const binaryStart = 20 + file.readUInt32LE(12) + 8
      for (let i = 0; i < accessor.count; i++) {
        const offset =
          binaryStart +
          (view.byteOffset ?? 0) +
          (accessor.byteOffset ?? 0) +
          i * (view.byteStride ?? 12)
        const x = file.readFloatLE(offset),
          y = file.readFloatLE(offset + 4),
          z = file.readFloatLE(offset + 8)
        const gx = Math.round((x + 64) / 2),
          gz = Math.round((z + 64) / 2)
        const key = gz * (terrain.width + 1) + gx
        assert(
          Math.abs(y - terrain.heights[key]) < 0.00001,
          `Terrain visual height differs from navigation metadata at ${key}`,
        )
        heights.set(key, y)
      }
    }
    assert.equal(
      heights.size,
      terrain.heights.length,
      'Every grid vertex must exist in the visual mesh',
    )
  }
  const triangles = json.meshes
    .flatMap((m) => m.primitives)
    .reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0)
  console.log(
    `${name}: ${(file.length / 1024).toFixed(0)} KB, ${triangles.toLocaleString('en-US')} triangles, Blender source ✓`,
  )
}
console.log(
  'Terrain heights match GLB vertices. Required animation nodes present.',
)
