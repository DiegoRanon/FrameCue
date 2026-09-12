-- Row-level security and privileges for the M6 schema (FR-01, NFR-08, NFR-09).
-- Run with `npm run db:test` against the local stack.

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Fixtures, as the database owner -------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'coach-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'coach-b@example.test');

select is(
  (select count(*)::int from public.coaches),
  2,
  'signing up creates a coach row'
);

insert into public.sessions (id, coach_id, title, scheduled_at, duration_minutes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A lesson', now(), 30),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'B lesson', now(), 45);

insert into public.invitations (session_id, token_hash, expires_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hash-a', now() + interval '2 hours'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'hash-b', now() + interval '2 hours');

insert into public.session_events (session_id, event_type, actor_role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'session_created', 'coach'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'session_created', 'coach');

-- Coach A --------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select results_eq(
  $$ select title from public.sessions order by title $$,
  $$ values ('A lesson') $$,
  'a coach sees only their own sessions'
);

select is(
  (select count(*)::int from public.session_events),
  1,
  'a coach sees only events on their own sessions'
);

select is(
  (select count(*)::int from public.coaches),
  1,
  'a coach sees only their own coach row'
);

select throws_ok(
  $$ select * from public.invitations $$,
  '42501',
  null,
  'a coach cannot read invitations'
);

select lives_ok(
  $$ insert into public.sessions (title, scheduled_at, duration_minutes) values ('A second', now(), 60) $$,
  'a coach can create a session'
);

select is(
  (select coach_id from public.sessions where title = 'A second'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'a new session belongs to the coach who created it'
);

select throws_ok(
  $$ insert into public.sessions (coach_id, title, scheduled_at, duration_minutes)
     values ('22222222-2222-2222-2222-222222222222', 'Forged', now(), 30) $$,
  '42501',
  null,
  'a coach cannot create a session for another coach'
);

select throws_ok(
  $$ update public.sessions set status = 'ended', ended_at = now() $$,
  '42501',
  null,
  'a coach cannot change a session directly'
);

select throws_ok(
  $$ delete from public.sessions $$,
  '42501',
  null,
  'a coach cannot delete sessions'
);

select throws_ok(
  $$ insert into public.session_events (session_id, event_type, actor_role)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'session_ended', 'coach') $$,
  '42501',
  null,
  'a coach cannot write session events'
);

select lives_ok(
  $$ update public.coaches set display_name = 'Coach A' $$,
  'a coach can set their own display name'
);

select throws_ok(
  $$ update public.coaches set email = 'someone-else@example.test' $$,
  '42501',
  null,
  'a coach cannot change their email through the table'
);

-- RLS makes this match no rows rather than fail; checked below as the owner.
update public.coaches set display_name = 'Hijacked'
where id = '22222222-2222-2222-2222-222222222222';

-- Coach B --------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select results_eq(
  $$ select title from public.sessions order by title $$,
  $$ values ('B lesson') $$,
  'the other coach sees only their own sessions'
);

-- Anonymous ------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.sessions $$,
  '42501',
  null,
  'anon cannot read sessions'
);

select throws_ok(
  $$ select * from public.coaches $$,
  '42501',
  null,
  'anon cannot read coaches'
);

select throws_ok(
  $$ select * from public.session_events $$,
  '42501',
  null,
  'anon cannot read session events'
);

-- Owner checks ---------------------------------------------------------------

reset role;

select is(
  (select display_name from public.coaches where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'a coach cannot rename another coach'
);

create function pg_temp.bucket_count() returns integer
language plpgsql
as $$
declare
  total integer;
begin
  if to_regclass('storage.buckets') is null then
    return 0;
  end if;
  execute 'select count(*)::int from storage.buckets' into total;
  return total;
end;
$$;

select is(pg_temp.bucket_count(), 0, 'no storage bucket exists (NFR-09)');

select is(
  (select count(*)::int from public.session_events where event_type = 'session_ended'),
  0,
  'the rejected event insert left nothing behind'
);

select * from finish();

rollback;
