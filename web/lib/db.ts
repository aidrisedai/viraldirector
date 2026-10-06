import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Postgres (Railway's Postgres plugin provides DATABASE_URL). Tables are created on first use, so a fresh
// database needs no manual setup.

export const dbConfigured = () => Boolean(process.env.DATABASE_URL);

const SCHEMA = `
create table if not exists projects (
  id text primary key,
  user_id text not null,
  name text not null,
  goal text not null default '',
  per_week int not null default 7,
  duration_days int,
  start_date date not null,
  defaults jsonb not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user on projects (user_id, archived, created_at desc);

create table if not exists ideas (
  id text primary key,
  project_id text not null references projects (id) on delete cascade,
  user_id text not null,
  title text not null,
  concept text not null,
  angle text not null default '',
  status text not null default 'open',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ideas_project on ideas (project_id, status, position);

create table if not exists videos (
  id text primary key,
  user_id text not null,
  project_id text references projects (id) on delete set null,
  idea_id text,
  title text not null,
  concept text not null default '',
  hook text not null default '',
  caption text not null default '',
  seconds real,
  format text,
  thumb text,
  status text not null default 'draft',
  brief jsonb,
  plan jsonb,
  made_at timestamptz,
  posted_at timestamptz,
  posted_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists videos_user on videos (user_id, project_id, created_at desc);
`;

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });
    pool.on("error", (e) => console.error("Postgres pool error", e.message));
  }
  ready ??= pool.query(SCHEMA).then(() => undefined, (e) => {
    ready = null; // try again on the next request
    throw e;
  });
  return pool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = getPool();
  await ready;
  return (await p.query<T>(sql, params)).rows;
}

/** Short, URL-safe ids. */
export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** For tests: close the pool between runs. */
export async function closeDb() {
  await pool?.end();
  pool = null;
  ready = null;
}
