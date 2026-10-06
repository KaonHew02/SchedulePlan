/**
 * Writes dist/sw.js, after `vite build` has written everything else.
 *
 * The worker (src/sw.ts) keeps a copy of the whole published site so the app
 * opens with no signal. It has to be told what the whole site is, and which
 * version of it — and only the finished dist/ folder can say: the script
 * names carry hashes that do not exist until the build has run, and public/
 * (the flags, the icons) is copied in by Vite rather than bundled.
 *
 * So: list every file in dist/ with a hash of each, and put the list, and a
 * hash of the whole list, in front of the compiled worker. A change to any
 * file — one line of code, one flag — makes a different sw.js, and a
 * different sw.js is how a browser learns there is a new version to fetch.
 *
 * A Node script after the build rather than a Vite plugin because it needs the
 * file system, and vite.config.ts is type-checked with the app's browser
 * types. Adding Node's types there would change what setTimeout returns on
 * every screen.
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { transformWithEsbuild } from 'vite'

const DIST = 'dist'
const WORKER = 'sw.js'
const SOURCE = resolve('src/sw.ts')

const files = readdirSync(DIST, { recursive: true })
  .map((path) => String(path).replaceAll('\\', '/'))
  .filter((path) => path !== WORKER && statSync(join(DIST, path)).isFile())
  .sort()

if (!files.includes('index.html')) {
  throw new Error(`${DIST}/index.html is missing. Run this after vite build, not instead of it.`)
}

const { code } = await transformWithEsbuild(readFileSync(SOURCE, 'utf8'), SOURCE, {
  loader: 'ts',
  target: 'es2020',
})

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

// Each file's own hash is how the next version knows it can keep that file
// rather than download it again.
let bytes = 0
const precache = files.map((path) => {
  const content = readFileSync(join(DIST, path))
  bytes += content.length
  return [path, sha256(content).slice(0, 16)]
})

// The worker's own code counts too, so a fix to it alone is a new version.
const version = sha256(code + JSON.stringify(precache)).slice(0, 12)

writeFileSync(
  join(DIST, WORKER),
  `const VERSION = ${JSON.stringify(version)};\n` +
    `const PRECACHE = ${JSON.stringify(precache)};\n\n` +
    code,
)

console.log(
  `${DIST}/${WORKER}  offline copy of ${files.length} files, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB, version ${version}`,
)
