CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS parties_updated_at ON parties (updated_at);
