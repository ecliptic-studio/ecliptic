
-- mcpkey table
CREATE TABLE IF NOT EXISTS mcpkey (
    id TEXT NOT NULL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,

    -- User-facing name for this key
    internal_name TEXT NOT NULL,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Trigger to update datastore.updated_at
CREATE TRIGGER IF NOT EXISTS update_mcpkey_updated_at
    AFTER UPDATE ON mcpkey
    FOR EACH ROW
BEGIN
    UPDATE mcpkey SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Indexes for mcpkey table
CREATE INDEX IF NOT EXISTS idx_mcpkey_org_id ON mcpkey(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcpkey_created_at ON mcpkey(created_at DESC);
