// Local test stack for Coop: a disposable Postgres cluster + PostgREST + a tiny
// proxy that serves Supabase's URL layout (/rest/v1), so the backend's
// supabase-js client runs unchanged against it.
//
//   node scripts/local-stack.mjs up      start everything (creates and migrates the DB on first run)
//   node scripts/local-stack.mjs reset   drop and re-create the database, re-apply all migrations
//   node scripts/local-stack.mjs db      Postgres only (create + migrate; --reset to rebuild)
//   node scripts/local-stack.mjs down    stop everything
//   node scripts/local-stack.mjs env     print the backend environment for this stack
//
// Nothing here touches any other Postgres on the machine: the cluster lives in
// backend/.local/pg and listens on its own port with trust auth on localhost only.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SignJWT } from 'jose'

const root = fileURLToPath(new URL('..', import.meta.url))
const LOCAL = join(root, '.local')
const PG_DATA = join(LOCAL, 'pg')
const BIN = join(LOCAL, 'bin')
const STATE = join(LOCAL, 'stack.json')
const PG_BIN = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin'
const POSTGREST_VERSION = 'v14.18'

export const STACK = {
  pgPort: 54329,
  postgrestPort: 54330,
  proxyPort: 54321,
  db: 'coop',
  // Local-only signing secret. Tokens signed with it are accepted by the local PostgREST and backend only.
  jwtSecret: 'coop-local-stack-jwt-secret-not-for-production-use',
}
export const supabaseUrl = `http://127.0.0.1:${STACK.proxyPort}`
export const databaseUrl = `postgres://postgres@localhost:${STACK.pgPort}/${STACK.db}`

const exe = (name) => join(PG_BIN, process.platform === 'win32' ? `${name}.exe` : name)
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr || r.stdout}`)
  return r.stdout
}
const psql = (args, db = STACK.db) =>
  run(exe('psql'), ['-h', 'localhost', '-p', String(STACK.pgPort), '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', ...args])

export async function serviceKey() {
  return new SignJWT({ role: 'service_role', iss: 'coop-local' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10y')
    .sign(new TextEncoder().encode(STACK.jwtSecret))
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'))
  } catch {
    return {}
  }
}
const writeState = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2))
const alive = (pid) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function pgReady() {
  return spawnSync(exe('pg_isready'), ['-h', 'localhost', '-p', String(STACK.pgPort)], { stdio: 'ignore' }).status === 0
}

function pgRunning() {
  return spawnSync(exe('pg_ctl'), ['status', '-D', PG_DATA], { encoding: 'utf8' }).status === 0
}

function startPostgres() {
  mkdirSync(LOCAL, { recursive: true })
  if (!existsSync(join(PG_DATA, 'PG_VERSION'))) {
    console.log('• creating local Postgres cluster')
    run(exe('initdb'), ['-D', PG_DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C'])
  }
  if (!pgRunning()) {
    console.log(`• starting Postgres on :${STACK.pgPort}`)
    // Postgres gets its own hidden console (detached): on Windows a server tied to the caller's
    // console dies with 0xC0000142 once that console closes, and piped stdio would block spawnSync.
    const child = spawn(exe('pg_ctl'), [
      'start', '-D', PG_DATA, '-l', join(LOCAL, 'postgres.log'),
      '-o', `-p ${STACK.pgPort} -c listen_addresses=localhost -c max_connections=200 -c shared_buffers=256MB -c fsync=off -c synchronous_commit=off`,
    ], { detached: true, stdio: 'ignore', windowsHide: true })
    child.unref()
    for (let i = 0; i < 150 && !pgReady(); i++) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},200)'])
    if (!pgReady()) throw new Error('Postgres did not start (see backend/.local/postgres.log)')
  }
}

export function resetDatabase() {
  console.log(`• (re)creating database "${STACK.db}" and applying migrations`)
  psql(['-c', `drop database if exists ${STACK.db} with (force)`, '-c', `create database ${STACK.db}`], 'postgres')
  psql(['-f', join(root, 'supabase', 'tests', 'supabase-stubs.sql')])
  const dir = join(root, 'supabase', 'migrations')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    psql(['-f', join(dir, f)])
    console.log(`  applied ${f}`)
  }
  // PostgREST caches the schema and in-database config: tell it to reload.
  psql(['-c', "notify pgrst, 'reload schema'", '-c', "notify pgrst, 'reload config'"])
}

function ensurePostgrest() {
  // Not downloaded automatically: install it yourself (see README, "Local test stack").
  const local = join(BIN, process.platform === 'win32' ? 'postgrest.exe' : 'postgrest')
  if (existsSync(local)) return local
  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['postgrest'], { encoding: 'utf8' })
  if (onPath.status === 0) return onPath.stdout.split(/\r?\n/)[0].trim()
  throw new Error(
    `PostgREST ${POSTGREST_VERSION} is not installed. Download postgrest-${POSTGREST_VERSION}-windows-x86-64.zip from\n` +
      `https://github.com/PostgREST/postgrest/releases/tag/${POSTGREST_VERSION} and put postgrest.exe in backend/.local/bin/`,
  )
}

function startDetached(name, cmd, args, env = {}) {
  const log = openSync(join(LOCAL, `${name}.log`), 'a')
  const child = spawn(cmd, args, { detached: true, stdio: ['ignore', log, log], windowsHide: true, env: { ...process.env, ...env } })
  child.unref()
  return child.pid
}

async function waitFor(url, label) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url)
      if (r.status < 500) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`${label} did not start (see backend/.local/${label}.log)`)
}

async function up({ reset = false } = {}) {
  const firstRun = !existsSync(join(PG_DATA, 'PG_VERSION'))
  startPostgres()
  const hasDb = psql(['-tAc', `select 1 from pg_database where datname = '${STACK.db}'`], 'postgres').trim() === '1'
  if (firstRun || reset || !hasDb) resetDatabase()

  const state = readState()
  const postgrest = ensurePostgrest()
  if (!alive(state.postgrestPid)) {
    const conf = join(LOCAL, 'postgrest.conf')
    writeFileSync(
      conf,
      [
        `db-uri = "postgres://authenticator@localhost:${STACK.pgPort}/${STACK.db}"`,
        'db-schemas = "public"',
        'db-anon-role = "anon"',
        `jwt-secret = "${STACK.jwtSecret}"`,
        `server-port = ${STACK.postgrestPort}`,
        'db-pool = 40',
        'log-level = "warn"',
      ].join('\n'),
    )
    console.log(`• starting PostgREST on :${STACK.postgrestPort}`)
    state.postgrestPid = startDetached('postgrest', postgrest, [conf])
  }
  if (!alive(state.proxyPid)) {
    console.log(`• starting Supabase-style proxy on :${STACK.proxyPort}`)
    state.proxyPid = startDetached('proxy', process.execPath, [join(root, 'scripts', 'local-proxy.mjs')], {
      PROXY_PORT: String(STACK.proxyPort),
      POSTGREST_PORT: String(STACK.postgrestPort),
    })
  }
  writeState(state)
  await waitFor(`http://127.0.0.1:${STACK.postgrestPort}/`, 'postgrest')
  await waitFor(`${supabaseUrl}/rest/v1/`, 'proxy')
  console.log(`✓ local stack ready: Postgres :${STACK.pgPort}, Supabase API ${supabaseUrl}`)
}

function down() {
  const state = readState()
  for (const key of ['proxyPid', 'postgrestPid']) {
    if (alive(state[key])) {
      try {
        process.kill(state[key])
      } catch {
        /* already gone */
      }
    }
  }
  writeState({})
  if (pgRunning()) run(exe('pg_ctl'), ['stop', '-D', PG_DATA, '-m', 'fast', '-w'])
  console.log('✓ local stack stopped')
}

export async function backendEnv() {
  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SECRET_KEY: await serviceKey(),
    AUTH_JWT_SECRET: STACK.jwtSecret,
    FRONTEND_ORIGINS: 'http://localhost:5173',
  }
}

// CLI ----------------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2] ?? 'up'
  if (cmd === 'up') await up()
  else if (cmd === 'reset') {
    startPostgres()
    resetDatabase()
    await up()
  } else if (cmd === 'db') {
    // Postgres only (no PostgREST): create + migrate on first run, --reset to rebuild.
    const fresh = !existsSync(join(PG_DATA, 'PG_VERSION'))
    startPostgres()
    if (fresh || process.argv.includes('--reset')) resetDatabase()
    console.log(`✓ local Postgres ready: ${databaseUrl}`)
  } else if (cmd === 'down') down()
  else if (cmd === 'env') for (const [k, v] of Object.entries(await backendEnv())) console.log(`${k}=${v}`)
  else {
    console.error(`Unknown command "${cmd}". Use up | reset | down | env.`)
    process.exit(1)
  }
}
