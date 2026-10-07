-- Tables for cloud save (D1 / SQLite). Apply with npm run cloud:db (production) or npm run cloud:db:local (local).

-- Anonymous accounts: identified by key alone. The key itself is not stored, only its SHA-256.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

-- One save per account: the whole SaveData as JSON. rev goes up by 1 on every write, to detect two devices overwriting each other.
CREATE TABLE IF NOT EXISTS saves (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
