-- M6 session foundation: the four entities of spec section 7.4 and nothing else.
--
-- No column, table, or bucket here can hold media. The backend never receives a
-- recording artifact, which is what makes FR-15, NFR-09 and AC-13 structural
-- rather than a policy.

-- ---------------------------------------------------------------------------
-- Coaches: one row per Supabase Auth user, created on first sign-in.
-- ---------------------------------------------------------------------------

create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create function public.handle_new_coach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coaches (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_coach() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_coach();

-- ---------------------------------------------------------------------------
-- Sessions: a dated one-to-one lesson (spec sections 2.3, 4, 5.1).
-- ---------------------------------------------------------------------------

create type public.session_status as enum ('scheduled', 'ended');

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references public.coaches (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  student_name text check (student_name is null or char_length(student_name) between 1 and 60),
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (30, 45, 60)),
  status public.session_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint sessions_ended_at_matches_status check ((status = 'ended') = (ended_at is not null))
);

create index sessions_coach_scheduled_idx on public.sessions (coach_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- Invitations: exactly one per session, so exactly one student (section 5.1).
-- Only a hash of the token is stored (NFR-08, NFR-10).
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Session events: non-media metadata only (section 9.2, AC-13).
-- ---------------------------------------------------------------------------

create table public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'session_created',
      'participant_join_attempted',
      'participant_connected',
      'session_ended',
      'replay_15_prepared',
      'replay_30_prepared',
      'replay_replaced',
      'replay_discarded',
      'replay_shown',
      'replay_failed',
      'returned_live',
      'permission_denied',
      'connection_degraded',
      'reconnection_started',
      'reconnection_succeeded'
    )
  ),
  actor_role text not null check (actor_role in ('coach', 'student', 'system')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index session_events_session_idx on public.session_events (session_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants everything on new public tables to anon and
-- authenticated by default; take that away and grant back only what the app
-- does directly. Everything else goes through the edge functions, which use
-- the service role.
-- ---------------------------------------------------------------------------

revoke all on table public.coaches, public.sessions, public.invitations, public.session_events
from anon, authenticated;

grant select on table public.coaches to authenticated;
grant update (display_name) on table public.coaches to authenticated;

-- coach_id, status and ended_at are deliberately not insertable: coach_id
-- defaults to the caller, and a session is only ended by the end-session
-- function, which also closes the LiveKit room.
grant select on table public.sessions to authenticated;
grant insert (title, student_name, scheduled_at, duration_minutes) on table public.sessions
to authenticated;

grant select on table public.session_events to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security: a coach reaches only their own data (FR-01).
-- invitations has RLS enabled and no policies at all, so no client can read it.
-- ---------------------------------------------------------------------------

alter table public.coaches enable row level security;
alter table public.sessions enable row level security;
alter table public.invitations enable row level security;
alter table public.session_events enable row level security;

create policy "Coaches read their own row"
on public.coaches for select to authenticated
using (id = (select auth.uid()));

create policy "Coaches update their own row"
on public.coaches for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Coaches read their own sessions"
on public.sessions for select to authenticated
using (coach_id = (select auth.uid()));

create policy "Coaches create sessions as themselves"
on public.sessions for insert to authenticated
with check (coach_id = (select auth.uid()));

create policy "Coaches read events on their own sessions"
on public.session_events for select to authenticated
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_events.session_id
      and sessions.coach_id = (select auth.uid())
  )
);
