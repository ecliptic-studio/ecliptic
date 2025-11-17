CREATE TABLE IF NOT EXISTS external_connection (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('microsoft', 'google')),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    scope TEXT NOT NULL,
    subscriptions TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS external_email (
    email TEXT NOT NULL PRIMARY KEY,
    external_connection_id TEXT NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE
);

-- Indexes for external_email table
CREATE INDEX IF NOT EXISTS idx_external_email_external_connection_id ON external_email(external_connection_id);
