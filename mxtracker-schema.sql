CREATE TABLE IF NOT EXISTS devices (
  employee_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  install_id TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  device TEXT,
  android TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  speed REAL,
  bearing REAL,
  battery INTEGER,
  captured_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  FOREIGN KEY(employee_id) REFERENCES devices(employee_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_employee_time
ON locations(employee_id, received_at DESC);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  FOREIGN KEY(employee_id) REFERENCES devices(employee_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shifts_employee_time
ON shifts(employee_id, start_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings(key,value) VALUES('registration_enabled','1');