// Repairs Next.js if a VS Code extension (Console Ninja) has injected code into
// node_modules/next. That injection crashes Next's worker processes, and every API
// route with an id in its path then fails with an HTML 500.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export function ensureCleanNext(root) {
  const nextDir = join(root, 'node_modules', 'next')
  const patched = ['dist/server/lib/start-server.js', 'dist/compiled/webpack/bundle5.js']
    .map((f) => join(nextDir, f))
    .some((f) => existsSync(f) && readFileSync(f, 'utf8').includes('build-hook-start'))
  if (!patched) return nextDir

  console.log('\n⚠  Next.js in node_modules was modified by the Console Ninja VS Code extension.')
  console.log('   This crashes the API with "Jest worker encountered 2 child process exceptions".')
  console.log('   Reinstalling a clean copy of Next.js... (disable Console Ninja for this workspace to stop it coming back)\n')
  rmSync(nextDir, { recursive: true, force: true })
  // npm sets npm_execpath to its own CLI script; running it with node avoids cmd.exe entirely.
  const npmCli = process.env.npm_execpath
  const r = npmCli
    ? spawnSync(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' })
    : spawnSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error('\nCould not reinstall Next.js. Run `npm install` in the backend folder, then try again.')
    process.exit(r.status ?? 1)
  }
  return nextDir
}
