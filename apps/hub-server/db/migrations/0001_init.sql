create extension if not exists pgcrypto;
create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  auth_provider text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table gateways (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  handle citext not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  visibility text not null default 'invite_only' check (visibility in ('private', 'invite_only', 'friends_only', 'public')),
  accepts_friend_requests boolean not null default true,
  accepts_task_requests boolean not null default false,
  status text not null default 'offline' check (status in ('online', 'recently_active', 'offline')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gateways_user_id_idx on gateways(user_id);
create index gateways_status_last_seen_idx on gateways(status, last_seen_at desc);

create table gateway_tags (
  gateway_id uuid not null references gateways(id) on delete cascade,
  tag citext not null,
  created_at timestamptz not null default now(),
  primary key (gateway_id, tag)
);

create index gateway_tags_tag_idx on gateway_tags(tag);

create table gateway_credentials (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null references gateways(id) on delete cascade,
  credential_type text not null,
  token_hash text not null,
  label text,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index gateway_credentials_gateway_id_idx on gateway_credentials(gateway_id);

create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_gateway_id uuid not null references gateways(id) on delete cascade,
  to_gateway_id uuid not null references gateways(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'canceled', 'expired')),
  message text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_gateway_id <> to_gateway_id)
);

create unique index friend_requests_one_pending_per_direction_idx
  on friend_requests(from_gateway_id, to_gateway_id)
  where status = 'pending';

create index friend_requests_to_status_created_idx on friend_requests(to_gateway_id, status, created_at desc);
create index friend_requests_from_status_created_idx on friend_requests(from_gateway_id, status, created_at desc);

create table friendships (
  id uuid primary key default gen_random_uuid(),
  gateway_a_id uuid not null references gateways(id) on delete cascade,
  gateway_b_id uuid not null references gateways(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (gateway_a_id <> gateway_b_id),
  unique (gateway_a_id, gateway_b_id)
);

create index friendships_gateway_a_idx on friendships(gateway_a_id);
create index friendships_gateway_b_idx on friendships(gateway_b_id);

create table blocks (
  blocker_gateway_id uuid not null references gateways(id) on delete cascade,
  blocked_gateway_id uuid not null references gateways(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_gateway_id, blocked_gateway_id),
  check (blocker_gateway_id <> blocked_gateway_id)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm')),
  created_by_gateway_id uuid references gateways(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  gateway_id uuid not null references gateways(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_message_id uuid,
  muted_until timestamptz,
  primary key (conversation_id, gateway_id)
);

create index conversation_members_gateway_id_idx on conversation_members(gateway_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_gateway_id uuid references gateways(id) on delete set null,
  message_type text not null check (message_type in ('text', 'system')),
  body text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index messages_conversation_created_idx on messages(conversation_id, created_at desc);

alter table conversation_members
  add constraint conversation_members_last_read_message_fk
  foreign key (last_read_message_id) references messages(id) on delete set null;

create table friend_scopes (
  from_gateway_id uuid not null references gateways(id) on delete cascade,
  to_gateway_id uuid not null references gateways(id) on delete cascade,
  scope_name text not null,
  state text not null check (state in ('granted', 'denied')),
  updated_at timestamptz not null default now(),
  updated_by_gateway_id uuid references gateways(id) on delete set null,
  primary key (from_gateway_id, to_gateway_id, scope_name),
  check (from_gateway_id <> to_gateway_id)
);

create table gateway_presence_sessions (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null references gateways(id) on delete cascade,
  connection_type text not null,
  user_agent text,
  ip_address inet,
  connected_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  disconnected_at timestamptz
);

create index gateway_presence_sessions_gateway_id_idx on gateway_presence_sessions(gateway_id);
create index gateway_presence_sessions_last_heartbeat_idx on gateway_presence_sessions(last_heartbeat_at desc);

create table audit_logs (
  id bigserial primary key,
  actor_gateway_id uuid references gateways(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  target_gateway_id uuid references gateways(id) on delete set null,
  action text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on audit_logs(actor_gateway_id, created_at desc);
create index audit_logs_target_created_idx on audit_logs(target_gateway_id, created_at desc);
create index audit_logs_action_created_idx on audit_logs(action, created_at desc);

create table invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by_gateway_id uuid not null references gateways(id) on delete cascade,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table invite_claims (
  invite_id uuid not null references invites(id) on delete cascade,
  claimed_by_gateway_id uuid not null references gateways(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invite_id, claimed_by_gateway_id)
);
