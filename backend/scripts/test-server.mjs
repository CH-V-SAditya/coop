// A second copy of the Coop API for automated tests, so tests never depend on (or disturb)
// the `npm run dev` server you are using yourself.
//
//   node scripts/test-server.mjs          start on port 4100 and keep running
//
// It uses its own build folder (.next-test) so it can run next to `npm run dev`, and reads
// the same backend/.env.local. Extra environment variables given to this process (for
// example AI_PROVIDER=mock) override .env.local.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureCleanNext } from './ensure-clean-next.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = process.env.TEST_API_PORT ?? '4100'
const nextDir = ensureCleanNext(root)

const next = spawn(process.execPath, [join(nextDir, 'dist', 'bin', 'next'), 'dev', '--port', port], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: '.next-test' },
})
next.on('error', (err) => {
  console.error('Could not start the test API:', err.message)
  process.exit(1)
})
next.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => next.kill(sig))
