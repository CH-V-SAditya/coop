// Applies Coop migrations to PGlite with Supabase stubs and runs an engine scenario.
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';

const MIG = process.argv[2];
const db = new PGlite({ extensions: { citext, pgcrypto } });

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security; grant all on storage.objects, storage.buckets to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

let failures = 0;
const ok = (msg) => console.log('  ✔ ' + msg);
const bad = (msg) => { failures++; console.log('  ✘ ' + msg); };

async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role authenticated;`);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec('reset role;'); }
}
async function expectErr(label, p, needle) {
  try { await p; bad(`${label}: expected error containing "${needle}"`); }
  catch (e) { (e.message.includes(needle) ? ok : bad)(`${label} → ${e.message}`); }
}
function check(label, cond, extra = '') { (cond ? ok : bad)(label + (extra ? ` (${extra})` : '')); }

await db.exec(STUBS);
for (const f of fs.readdirSync(MIG).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); console.log('applied', f); }
  catch (e) { console.log('FAILED', f, '\n', e.message, e.position ?? ''); process.exit(1); }
}

console.log('\nScenario');
const users = {};
for (const n of ['a', 'b', 'c', 'd']) {
  const r = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${n}@example.com`, { full_name: `User ${n.toUpperCase()}` }]);
  users[n] = r.rows[0].id;
}
check('profiles created by trigger', (await db.query('select count(*)::int c from public.profiles')).rows[0].c === 4);

const [org] = await as(users.a, `select * from public.create_organisation('Acme Labs')`);
check('organisation created', !!org?.id, `${org.slug}, prefix ${org.task_key_prefix}`);
const [grp] = await as(users.a, `select * from public.create_group($1, 'Website', 'Ship the marketing website')`, [org.id]);
check('group created', !!grp?.id);

const [invB] = await as(users.a, `select * from public.create_invitation($1, 'B@example.com', $2, 'member', 'member', 'Frontend')`, [org.id, grp.id]);
const [invC] = await as(users.a, `select * from public.create_invitation($1, 'c@example.com', $2)`, [org.id, grp.id]);
await expectErr('wrong user cannot accept', as(users.d, `select public.accept_invitation($1)`, [invB.token]), 'different email');
const [prev] = await as(users.b, `select * from public.get_invitation($1)`, [invB.token]);
check('invitee can preview invitation', prev?.organisation_name === 'Acme Labs' && prev?.functional_role === 'Frontend');
await as(users.b, `select public.accept_invitation($1)`, [invB.token]);
await as(users.c, `select public.accept_invitation($1)`, [invC.token]);
await expectErr('invitation single use', as(users.b, `select public.accept_invitation($1)`, [invB.token]), 'accepted');

const dir = await as(users.a, `select * from public.group_member_directory where group_id = $1 order by email`, [grp.id]);
check('directory has 3 members', dir.length === 3);
const m = Object.fromEntries(dir.map((r) => [r.email[0], r]));
check('B has admin-assigned functional role', m.b.functional_role === 'Frontend' && m.b.role_source === 'admin');
check('C has no role (AI may infer later)', m.c.functional_role === null);

check('outsider D sees no tasks/groups', (await as(users.d, `select * from public.groups`)).length === 0);
await expectErr('B (no can_create_tasks) cannot create task',
  as(users.b, `insert into public.tasks (organisation_id, group_id, title) values ($1,$2,'x')`, [org.id, grp.id]), 'row-level security');

const ins = `insert into public.tasks (organisation_id, group_id, title, owner_id, reviewer_id) values ($1,$2,$3,$4,$5) returning *`;
const [t1] = await as(users.a, ins, [org.id, grp.id, 'QA assessment', m.b.organisation_member_id, m.a.organisation_member_id]);
const [t2] = await as(users.a, ins, [org.id, grp.id, 'Consolidated report', m.c.organisation_member_id, null]);
const [t3] = await as(users.a, ins, [org.id, grp.id, 'Finalise deployment schedule', m.a.organisation_member_id, null]);
check('tasks numbered per org', t1.task_number === 1 && t3.task_number === 3 && t1.status === 'draft');

await expectErr('owner must be group member',
  as(users.a, `insert into public.tasks (organisation_id, group_id, title, owner_id) values ($1,$2,'x', gen_random_uuid())`, [org.id, grp.id]), '');
await expectErr('direct status write is denied',
  as(users.b, `update public.tasks set status = 'completed' where id = $1`, [t1.id]), 'permission denied');

await as(users.a, `select public.add_task_dependency($1, $2)`, [t1.id, t2.id]);
await as(users.a, `select public.add_task_dependency($1, $2)`, [t2.id, t3.id]);
await expectErr('cycle rejected', as(users.a, `select public.add_task_dependency($1, $2)`, [t3.id, t1.id]), 'cycle');
await expectErr('self-dependency rejected', as(users.a, `select public.add_task_dependency($1, $1)`, [t1.id]), 'cycle');
await expectErr('SS type disabled in MVP', as(users.a, `select public.add_task_dependency($1, $2, 'start_to_start')`, [t1.id, t3.id]), 'finish-to-start');

const board = await as(users.c, `select title, unmet_dependency_count, task_key from public.task_board where group_id = $1 order by task_number`, [grp.id]);
check('C sees board with waiting flags', board.length === 3 && board[1].unmet_dependency_count === 1, board.map((r) => `${r.task_key}:${r.unmet_dependency_count}`).join(' '));

await expectErr('waiting task cannot become ready', as(users.a, `select public.transition_task($1, 'ready')`, [t2.id]), 'waiting on 1');
await expectErr('draft -> completed not allowed', as(users.a, `select public.transition_task($1, 'completed')`, [t1.id]), 'not allowed');
await as(users.a, `select public.transition_task($1, 'ready')`, [t1.id]);
await expectErr('C cannot start B\'s task', as(users.c, `select public.transition_task($1, 'in_progress')`, [t1.id]), 'not allowed');
await as(users.b, `select public.transition_task($1, 'in_progress')`, [t1.id]);
await as(users.b, `update public.tasks set progress = 60 where id = $1`, [t1.id]);

const [blk] = await as(users.b, `select * from public.report_blocker($1, 'QA review pending', 'approval')`, [t1.id]);
await expectErr('cannot mark blocked before confirmation', as(users.b, `select public.transition_task($1, 'blocked')`, [t1.id]), 'confirm');
await as(users.b, `select public.confirm_blocker($1)`, [blk.id]);
let [s] = await as(users.b, `select status, progress from public.tasks where id = $1`, [t1.id]);
check('confirming blocker blocks task, progress kept', s.status === 'blocked' && s.progress === 60, `${s.status} ${s.progress}%`);
await as(users.b, `select public.resolve_blocker($1, 'Approved by QA lead')`, [blk.id]);
[s] = await as(users.b, `select status from public.tasks where id = $1`, [t1.id]);
check('resolving last blocker resumes task', s.status === 'in_progress');

await as(users.b, `select public.transition_task($1, 'in_review')`, [t1.id]);
await expectErr('owner cannot accept own review', as(users.b, `select public.transition_task($1, 'completed')`, [t1.id]), 'not allowed');
await expectErr('request changes needs reason', as(users.a, `select public.transition_task($1, 'in_progress')`, [t1.id]), 'reason');
await as(users.a, `select public.transition_task($1, 'completed')`, [t1.id]);
const sat = await as(users.c, `select * from public.task_events where task_id = $1 and event_type = 'dependency_satisfied'`, [t2.id]);
check('successor notified: dependency_satisfied', sat.length === 1);
await as(users.a, `select public.transition_task($1, 'ready')`, [t2.id]);
await expectErr('no new unfinished prereq on started work', (async () => {
  await as(users.c, `select public.transition_task($1, 'in_progress')`, [t2.id]);
  await as(users.a, `select public.add_task_dependency($1, $2)`, [t3.id, t2.id]);
})(), '');

await expectErr('reopen needs reason', as(users.a, `select public.transition_task($1, 'in_progress')`, [t1.id]), 'reason');
await as(users.a, `select public.transition_task($1, 'in_progress', 'Found regression')`, [t1.id]);
const reo = await as(users.a, `select * from public.task_events where task_id = $1 and event_type = 'dependency_reopened'`, [t2.id]);
check('successor notified: dependency_reopened', reo.length === 1);

await expectErr('member cannot cancel', as(users.b, `select public.transition_task($1, 'cancelled', 'nope')`, [t3.id]), 'not allowed');
await as(users.a, `select public.transition_task($1, 'cancelled', 'Descoped')`, [t3.id]);
await expectErr('stale version rejected', as(users.a, `select public.transition_task($1, 'in_review', null, 1)`, [t1.id]), 'changed by someone else');

await as(users.b, `insert into public.task_comments (organisation_id, task_id, author_id, body) values ($1,$2,$3,'Fixed it')`, [org.id, t1.id, users.b]);
const ev = await as(users.b, `select event_type, from_status, to_status from public.task_events where task_id = $1 order by id`, [t1.id]);
console.log('    T1 history:', ev.map((e) => e.event_type + (e.to_status ? `(${e.from_status ?? ''}→${e.to_status})` : '')).join(', '));
check('history recorded', ev.length >= 10);
await expectErr('events immutable (even for owner role)', db.query(`update public.task_events set reason = 'x'`), 'immutable');
await expectErr('clients cannot insert events',
  as(users.a, `insert into public.task_events (organisation_id, task_id, event_type) values ($1,$2,'fake')`, [org.id, t1.id]), 'permission denied');
check('D cannot see events', (await as(users.d, `select * from public.task_events`)).length === 0);

const st = await as(users.a, `insert into storage.objects (bucket_id, name, owner) values ('context-documents', $1, $2) returning id`, [`${grp.id}/brief.pdf`, users.a]);
check('group admin can upload context doc', st.length === 1);
await expectErr('member without permission cannot upload',
  as(users.b, `insert into storage.objects (bucket_id, name, owner) values ('context-documents', $1, $2)`, [`${grp.id}/x.pdf`, users.b]), 'row-level security');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
