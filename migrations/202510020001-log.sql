
-- Create log table
CREATE TABLE log (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    app_id TEXT,
    workflow_id TEXT,
    chat_id TEXT,
    request_id TEXT,
    organization_id TEXT,
    user_id TEXT,
    service_id TEXT,
    service_resource_id TEXT,
    environment TEXT,
    level TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR', 'DEBUG')),
    message TEXT NOT NULL,
    metadata TEXT,
    error_entry TEXT,
    needs_action TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
