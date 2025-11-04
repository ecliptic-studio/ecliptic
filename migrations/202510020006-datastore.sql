-- Migration: 202510020006-datastore.sql
-- Datastore table for tracking managed SQL databases (e.g., Cloudflare D1)

-- datastore table (organization-scoped managed databases)
CREATE TABLE IF NOT EXISTS datastore (
    id TEXT NOT NULL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

    -- User-facing name for this datastore
    internal_name TEXT NOT NULL,

    -- Provider-specific details
    provider TEXT NOT NULL CHECK (provider IN ('sqlite', 'turso')),
    external_id TEXT NOT NULL, -- Provider's database ID (e.g., D1 database ID)
    external_name TEXT NOT NULL, -- Provider's database name

    schema_json TEXT NOT NULL,

    -- Connection details (stored as encrypted JSON)
    encrypted_json TEXT, -- Provider-specific connection details (e.g., API tokens, endpoints)

    -- Resource metadata
    region TEXT, -- Geographic region where database is hosted
    status TEXT DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'suspended', 'deleting', 'deleted', 'error')),

    -- Provisioning metadata
    provisioned_at TEXT,
    last_accessed_at TEXT,
    metadata_json TEXT, -- Additional provider-specific metadata

    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Ensure unique internal names per organization
    UNIQUE(organization_id, internal_name)
);

-- Trigger to update datastore.updated_at
CREATE TRIGGER IF NOT EXISTS update_datastore_updated_at
    AFTER UPDATE ON datastore
    FOR EACH ROW
BEGIN
    UPDATE datastore SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Indexes for datastore table
CREATE INDEX IF NOT EXISTS idx_datastore_org_id ON datastore(organization_id);
CREATE INDEX IF NOT EXISTS idx_datastore_provider ON datastore(provider);
CREATE INDEX IF NOT EXISTS idx_datastore_status ON datastore(status);
CREATE INDEX IF NOT EXISTS idx_datastore_external_id ON datastore(external_id);
CREATE INDEX IF NOT EXISTS idx_datastore_created_at ON datastore(created_at DESC);
