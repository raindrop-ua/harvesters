import { readdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(`${dir}/${entry.name}`)
      : [`${dir}/${entry.name}`],
  )
}
for (const file of files('src/game').filter((f) => /\.tsx?$/.test(f))) {
  const source = readFileSync(file, 'utf8')
  assert(
    !/(?:from\s*|import\s*\()?['"](?:react(?:-dom)?|three|@react-three|zustand)(?:[/'"])/.test(
      source,
    ),
    `${file}: simulation cannot depend on rendering or UI`,
  )
  assert(
    !/from\s*['"].*(?:app|rendering|ui)\//.test(source),
    `${file}: simulation cannot import presentation`,
  )
}
for (const file of files('src/rendering').filter(
  (f) => /\.tsx?$/.test(f) && !f.endsWith('DebugOverlay.tsx'),
)) {
  const source = readFileSync(file, 'utf8')
  assert(
    !/<[a-z]+Geometry\b|new\s+\w*Geometry\(/.test(source),
    `${file}: visible world geometry must come from Blender`,
  )
}
console.log(
  'Simulation imports are framework-independent. World geometry is loaded from Blender assets.',
)
