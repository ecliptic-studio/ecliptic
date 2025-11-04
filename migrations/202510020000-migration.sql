
-- Track database migrations
CREATE TABLE IF NOT EXISTS migration (
    filename TEXT NOT NULL PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

