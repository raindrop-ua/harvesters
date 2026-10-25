import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'

const names = [
  'terrain',
  'harvester',
  'refinery',
  'minerals',
  'rocks',
  'effects',
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
