// End-to-end smoke test: the locally running backend -> the Supabase project in .env.local.
//
//   npm run test:server    (in another terminal: the test copy of the API, port 4100)
//   npm run test:api:smoke
//
// It creates its own rows (all named "zz-test-...") and deletes them again, including on failure.
// Checks the happy path (person -> organisation -> group) and tenant isolation: a second person
// who is not a member must not be able to read or change anything in that organisation.
const API = process.env.API_URL ?? 'http://localhost:4100/api/v1'
const SB = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY
if (!SB || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set (run through `npm run test:api:smoke`).')
  process.exit(1)
}
const tag = `zz-test-${Date.now()}`

async function api(method, path, actor, body) {
  const started = Date.now()
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Coop-Actor': actor } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: r.status, json, ms: Date.now() - started }
}

// Direct database access with the secret key: used ONLY to clean up this run's rows.
async function rest(method, path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=representation' },
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}

let passed = 0
let failed = 0
function step(name, ok, detail = '') {
  if (ok) passed++
  else failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}
const leak = (r) => r.status === 200 && (Array.isArray(r.json) ? r.json.length > 0 : true)

let ownerId, outsiderId, orgId, groupId
try {
  const owner = await api('POST', '/people', null, { full_name: `${tag} owner` })
  ownerId = owner.json?.id
  step('create person', owner.status === 200 && !!ownerId, `[${owner.status}] ${owner.ms} ms`)

  const outsider = await api('POST', '/people', null, { full_name: `${tag} outsider` })
  outsiderId = outsider.json?.id
  step('create a second person', outsider.status === 200 && !!outsiderId, `[${outsider.status}] ${outsider.ms} ms`)

  const org = await api('POST', '/organisations', ownerId, { name: `${tag} org` })
  orgId = org.json?.id
  step('create organisation', org.status === 200 && !!orgId, `[${org.status}] ${org.ms} ms ${orgId ? '' : JSON.stringify(org.json)}`)

  const me = await api('GET', '/me', ownerId)
  step('creator is its owner', me.status === 200 && me.json?.memberships?.[0]?.role === 'owner', `[${me.status}] ${me.ms} ms`)

  const group = await api('POST', `/organisations/${orgId}/groups`, ownerId, { name: `${tag} group` })
  groupId = group.json?.id
  step('create group', group.status === 200 && !!groupId, `[${group.status}] ${group.ms} ms ${groupId ? '' : JSON.stringify(group.json)}`)

  const task = await api('POST', `/groups/${groupId}/tasks`, ownerId, { title: `${tag} task` })
  const taskId = task.json?.id
  step('create task', task.status === 200 && !!taskId, `[${task.status}] ${task.ms} ms ${taskId ? '' : JSON.stringify(task.json)}`)

  const board = await api('GET', `/groups/${groupId}/tasks`, ownerId)
  step('owner sees the board', board.status === 200 && board.json?.length === 1, `[${board.status}] ${board.ms} ms`)

  const people = await api('GET', '/people', ownerId)
  step('people picker still lists everyone', people.status === 200 && people.json?.some((p) => p.id === outsiderId), `[${people.status}] ${people.ms} ms`)

  console.log('\nTenant isolation (the second person is not a member)')
  const probes = [
    ['list its groups', 'GET', `/organisations/${orgId}/groups`],
    ['list its members', 'GET', `/organisations/${orgId}/members`],
    ['open its group', 'GET', `/groups/${groupId}`],
    ['read its board', 'GET', `/groups/${groupId}/tasks`],
    ['open its task', 'GET', `/tasks/${taskId}`],
    ['create a group in it', 'POST', `/organisations/${orgId}/groups`, { name: `${tag} intruder` }],
    ['rename its group', 'PATCH', `/groups/${groupId}`, { name: `${tag} pwned` }],
    ['create a task in it', 'POST', `/groups/${groupId}/tasks`, { title: 'intruder' }],
    ['edit its task', 'PATCH', `/tasks/${taskId}`, { title: 'pwned' }],
    ['delete its task', 'DELETE', `/tasks/${taskId}`],
    ['move its task', 'POST', `/tasks/${taskId}/transition`, { to: 'cancelled', reason: 'x' }],
    ['comment on its task', 'POST', `/tasks/${taskId}/comments`, { body: 'hi' }],
    ['report a blocker on its task', 'POST', `/tasks/${taskId}/blockers`, { title: 'x', description: 'x' }],
    ['add themselves as a member', 'POST', `/organisations/${orgId}/members`, { user_id: outsiderId }],
  ]
  for (const [name, method, path, body] of probes) {
    const r = await api(method, path, outsiderId, body)
    step(`outsider cannot ${name}`, !leak(r), `[${r.status}]${leak(r) ? ' LEAK ' + JSON.stringify(r.json).slice(0, 100) : ''}`)
  }

  const after = await api('GET', `/tasks/${taskId}`, ownerId)
  const intact = after.status === 200 && after.json?.task?.title === `${tag} task` && after.json?.task?.status === 'draft'
  step('the task is unchanged afterwards', intact, `[${after.status}]`)
  const mine = await api('GET', '/me', outsiderId)
  step('the outsider gained no membership', mine.status === 200 && mine.json?.memberships?.length === 0, `[${mine.status}]`)
} catch (e) {
  step('run completed without an exception', false, e.message)
} finally {
  // Remove everything this run created (children first; task_events rows go with their tasks).
  const done = []
  if (orgId) {
    for (const table of ['tasks', 'group_members', 'groups', 'organisation_members']) {
      const column = table === 'group_members' ? null : 'organisation_id'
      const r = column
        ? await rest('DELETE', `${table}?${column}=eq.${orgId}`)
        : groupId
          ? await rest('DELETE', `group_members?group_id=eq.${groupId}`)
          : { status: 204 }
      done.push(`${table}=${r.status}`)
    }
    done.push(`organisations=${(await rest('DELETE', `organisations?id=eq.${orgId}`)).status}`)
  }
  const ids = [ownerId, outsiderId].filter(Boolean)
  if (ids.length) done.push(`profiles=${(await rest('DELETE', `profiles?id=in.(${ids.join(',')})`)).status}`)
  console.log('\ncleanup:', done.join(' '))
  const orgsLeft = (await rest('GET', `organisations?name=like.${tag}*&select=id`)).json?.length
  const peopleLeft = (await rest('GET', `profiles?full_name=like.${tag}*&select=id`)).json?.length
  step('test rows removed', orgsLeft === 0 && peopleLeft === 0, `organisations left: ${orgsLeft}, people left: ${peopleLeft}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
