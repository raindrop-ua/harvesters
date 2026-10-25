import { NodeIO } from '@gltf-transform/core'
import { dedup, prune, weld } from '@gltf-transform/functions'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { readFile, stat } from 'node:fs/promises'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const name of [
  'terrain',
  'refinery',
  'harvester',
  'minerals',
  'rocks',
  'effects',
]) {
  const path = `public/models/${name}.glb`
  const before = (await stat(path)).size
  const document = await io.read(path)
  const raw = await readFile(path)
  const metadata = JSON.parse(
    raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)),
  )
  const generator = metadata.extras?.sourceGenerator ?? metadata.asset.generator
  // Keep authored hierarchy/pivots and full-precision terrain. No lossy simplification.
  await document.transform(dedup(), weld(), prune({ keepLeaves: true }))
  document.getRoot().setExtras({
    ...document.getRoot().getExtras(),
    sourceGenerator: generator,
    sourceFile: `assets/blender/${name}.blend`,
  })
  await io.write(path, document)
  const after = (await stat(path)).size
  console.log(
    `${name}: ${(before / 1024).toFixed(0)} → ${(after / 1024).toFixed(0)} KB`,
  )
}
