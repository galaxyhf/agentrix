import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient(url?: string, anonKey?: string) {
  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabaseSchema = `
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  path text not null,
  updated_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  role text not null,
  model text not null,
  system_prompt text not null,
  color text not null,
  status text not null default 'idle'
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references agents(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  transcript jsonb not null default '[]'::jsonb
);

create table if not exists token_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_id uuid references agents(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table workspaces enable row level security;
alter table agents enable row level security;
alter table sessions enable row level security;
alter table token_history enable row level security;
`;

