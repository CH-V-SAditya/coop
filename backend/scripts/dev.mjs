// `npm run dev` for the Coop API.
//
// 1. Repairs Next.js if a VS Code extension (Console Ninja) has injected code
//    into node_modules/next. That injection crashes Next's worker processes, and
//    every API route with an id in its path then fails with an HTML 500.
// 2. Starts `next dev`, then requests every API route once so they are compiled
//    up front. Otherwise the first click on each screen waits ~3s for Turbopack.
import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureCleanNext } from './ensure-clean-next.mjs'

// fileURLToPath decodes %20, so folders with spaces ("NxtWave Projects") work.
const root = fileURLToPath(new URL('..', import.meta.url))
const port = process.env.PORT ?? '4000'

// 1. Repair a patched Next.js -------------------------------------------------
const nextDir = ensureCleanNext(root)

// 2. Start next dev and warm up every route ------------------------------------
// Run Next's CLI with node directly: no shell and no npx, so spaces in the path can't break it.
const next = spawn(process.execPath, [join(nextDir, 'dist', 'bin', 'next'), 'dev', '--port', port], { cwd: root, stdio: 'inherit' })
next.on('error', (err) => {
  console.error('Could not start Next.js:', err.message)
  process.exit(1)
})
next.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => next.kill(sig))

const ZERO = '00000000-0000-0000-0000-000000000000'
function routePaths(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return routePaths(full)
    if (name !== 'route.ts') return []
    const rel = relative(join(root, 'src', 'app'), dir).split(sep).join('/')
    return ['/' + rel.replace(/\[[^\]]+\]/g, ZERO)]
  })
}

const base = `http://localhost:${port}`
const waitForServer = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(base + '/')
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return false
}

if (await waitForServer()) {
  const paths = routePaths(join(root, 'src', 'app', 'api'))
  const started = Date.now()
  // Unauthenticated GETs: they return 401/405 quickly, but compile the route.
  // A few at a time keeps Turbopack from fighting itself.
  for (let i = 0; i < paths.length; i += 4) {
    await Promise.all(paths.slice(i, i + 4).map((p) => fetch(base + p).catch(() => {})))
  }
  console.log(`\n✓ Coop API warmed up: ${paths.length} routes compiled in ${((Date.now() - started) / 1000).toFixed(1)}s\n`)
}
