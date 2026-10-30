import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  use_ai INTEGER NOT NULL DEFAULT 0,
  rerun_of INTEGER,
  result_json TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);

CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_host TEXT NOT NULL,
  source_url TEXT NOT NULL,
  why_interesting TEXT NOT NULL,
  expected_benefit TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  verification TEXT NOT NULL,
  score_usefulness INTEGER NOT NULL,
  score_relevance INTEGER NOT NULL,
  score_feasibility INTEGER NOT NULL,
  score_visual INTEGER NOT NULL,
  score_complexity INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  origin TEXT NOT NULL DEFAULT 'rules',
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  created_at TEXT NOT NULL,
  status_changed_at TEXT,
  UNIQUE(key, source_host)
);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS page_cache (
  url TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,
  status INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  final_url TEXT NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS robots_cache (
  origin TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,
  status INTEGER NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  query TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  snippet TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(provider, query, url)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Результат .get() у node:sqlite — это обычный объект; приводим его к нужному типу. */
export function one<T>(db: Db, sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T>(db: Db, sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(db: Db, sql: string, ...params: SqlParam[]): { changes: number; lastId: number } {
  const r = db.prepare(sql).run(...params);
  return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
}

export type SqlParam = string | number | bigint | null | Uint8Array;
