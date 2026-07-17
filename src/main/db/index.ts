import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'path'

let db: DatabaseSync | null = null

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    focus_sec INTEGER NOT NULL,
    short_pause_sec INTEGER NOT NULL,
    long_pause_sec INTEGER NOT NULL,
    rounds_before_long INTEGER NOT NULL,
    is_preset INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE pause_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    method_id INTEGER NOT NULL REFERENCES methods(id),
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE intervals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    kind TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    planned_sec INTEGER NOT NULL,
    actual_sec INTEGER NOT NULL,
    skipped INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE INDEX idx_intervals_session ON intervals(session_id);
  CREATE INDEX idx_intervals_kind_time ON intervals(kind, started_at);
  CREATE INDEX idx_sessions_time ON sessions(started_at);
  `,
  // v2 — tasks
  `
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    schedule_kind TEXT NOT NULL DEFAULT 'daily',
    weekdays INTEGER NOT NULL DEFAULT 127,
    once_date TEXT,
    time_hhmm TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    created_day TEXT NOT NULL
  );
  CREATE TABLE task_completions (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    status TEXT NOT NULL,
    marked_at INTEGER NOT NULL,
    PRIMARY KEY (task_id, day)
  );
  CREATE INDEX idx_task_completions_day ON task_completions(day);
  `,
  // v3 — task priorities/categories, subtasks, blocked apps, simple timer modes
  `
  ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
  ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id);
  CREATE TABLE subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_subtasks_task ON subtasks(task_id);
  CREATE TABLE blocked_apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    exe TEXT NOT NULL UNIQUE COLLATE NOCASE,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  ALTER TABLE methods ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard';
  `
]

const DEFAULT_MESSAGES = [
  'Look at something 20 feet away for 20 seconds',
  'Stand up and stretch your back',
  'Drink some water',
  'Do 5 pushups',
  'Take three slow, deep breaths',
  'Relax your shoulders and unclench your jaw'
]

function migrate(d: DatabaseSync): void {
  const row = d.prepare('PRAGMA user_version').get() as { user_version: number }
  let version = Number(row.user_version)
  while (version < MIGRATIONS.length) {
    d.exec('BEGIN')
    try {
      d.exec(MIGRATIONS[version])
      version++
      d.exec(`PRAGMA user_version = ${version}`)
      d.exec('COMMIT')
    } catch (err) {
      d.exec('ROLLBACK')
      throw err
    }
  }
}

function seed(d: DatabaseSync): void {
  const methodCount = d.prepare('SELECT COUNT(*) AS n FROM methods').get() as { n: number }
  if (Number(methodCount.n) === 0) {
    d.prepare(
      `INSERT INTO methods (name, focus_sec, short_pause_sec, long_pause_sec, rounds_before_long, is_preset)
       VALUES ('Pomodoro', 25 * 60, 5 * 60, 15 * 60, 4, 1)`
    ).run()
  }
  const msgCount = d.prepare('SELECT COUNT(*) AS n FROM pause_messages').get() as { n: number }
  if (Number(msgCount.n) === 0) {
    const insert = d.prepare('INSERT INTO pause_messages (text, enabled, sort_order) VALUES (?, 1, ?)')
    DEFAULT_MESSAGES.forEach((text, i) => insert.run(text, i))
  }
  const projCount = d.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }
  if (Number(projCount.n) === 0) {
    d.prepare("INSERT INTO projects (name, color, created_at) VALUES ('General', '#8B5CF6', ?)").run(
      Math.floor(Date.now() / 1000)
    )
  }

  // Hidden method rows backing the simple timer modes (sessions.method_id is NOT NULL).
  // Insert-if-missing so existing databases get them after the v3 migration too.
  for (const kind of ['countdown', 'stopwatch'] as const) {
    const exists = d.prepare('SELECT id FROM methods WHERE kind = ?').get(kind)
    if (!exists) {
      d.prepare(
        `INSERT INTO methods (name, focus_sec, short_pause_sec, long_pause_sec, rounds_before_long, is_preset, kind)
         VALUES (?, 0, 0, 0, 1, 1, ?)`
      ).run(kind === 'countdown' ? 'Countdown' : 'Stopwatch', kind)
    }
  }
}

export function openDb(): DatabaseSync {
  const file = join(app.getPath('userData'), 'focus-on-me.db')
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  seed(db)
  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not opened')
  return db
}
