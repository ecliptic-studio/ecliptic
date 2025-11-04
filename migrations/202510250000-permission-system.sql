CREATE TABLE IF NOT EXISTS permission_type (
    id TEXT NOT NULL PRIMARY KEY,
    i18n_title TEXT NOT NULL,
    i18n_description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permission_action (
    id TEXT NOT NULL PRIMARY KEY,
    i18n_title TEXT NOT NULL,
    i18n_description TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS permission_allowed_action_by_type (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    permission_type_id TEXT NOT NULL REFERENCES permission_type(id) ON DELETE CASCADE,
    permission_action_id TEXT NOT NULL REFERENCES permission_action(id) ON DELETE CASCADE,
    UNIQUE(permission_type_id, permission_action_id)
);

-- Indexes for permission_allowed_action_by_type table
CREATE INDEX IF NOT EXISTS idx_permission_allowed_action_by_type_permission_type_id ON permission_allowed_action_by_type(permission_type_id);
CREATE INDEX IF NOT EXISTS idx_permission_allowed_action_by_type_permission_action_id ON permission_allowed_action_by_type(permission_action_id);


-- permission_target table
-- use id as path e.g. datastore:abc.table:def.column:ghi
CREATE TABLE IF NOT EXISTS permission_target (
    id TEXT NOT NULL, -- not unique e.g. datastore:* is used by multiple organizations
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    internal_name TEXT NOT NULL,
    permission_type_id TEXT NOT NULL REFERENCES permission_type(id) ON DELETE CASCADE,
    datastore_id TEXT REFERENCES datastore(id) ON DELETE CASCADE, -- optional if link exists

    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (organization_id, id)
);


-- Indexes for permission_target table
CREATE INDEX IF NOT EXISTS idx_permission_target_org_id ON permission_target(organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_target_id ON permission_target(id);

---- TABLE TO MAP USER AND MCP KEYS TO PERMISSION TARGETS
CREATE TABLE IF NOT EXISTS permission_mapping (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
    mcpkey_id TEXT REFERENCES mcpkey(id) ON DELETE CASCADE,
    permission_target_id TEXT NOT NULL,
    permission_target_org_id TEXT NOT NULL,
    permission_action_id TEXT NOT NULL REFERENCES permission_action(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, mcpkey_id, permission_target_id, permission_action_id),
    FOREIGN KEY (permission_target_id, permission_target_org_id) REFERENCES permission_target(id, organization_id) ON DELETE CASCADE
);

-- Indexes for permission_mapping table
CREATE INDEX IF NOT EXISTS idx_permission_mapping_user_id ON permission_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_mapping_mcpkey_id ON permission_mapping(mcpkey_id);
CREATE INDEX IF NOT EXISTS idx_permission_mapping_permission_target_id ON permission_mapping(permission_target_id);

-- Trigger to check if user_id or mcpkey_id is provided
CREATE TRIGGER IF NOT EXISTS check_permission_mapping_user_id_or_mcpkey_id_insert
    BEFORE INSERT ON permission_mapping
    FOR EACH ROW
    WHEN NEW.user_id IS NULL AND NEW.mcpkey_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'user_id or mcpkey_id must be provided');
END;

CREATE TRIGGER IF NOT EXISTS check_permission_mapping_user_id_or_mcpkey_id_update
    BEFORE UPDATE ON permission_mapping
    FOR EACH ROW
    WHEN NEW.user_id IS NULL AND NEW.mcpkey_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'user_id or mcpkey_id must be provided');
END;

-- Trigger to check if permission_action is allowed for the permission_type of the target
CREATE TRIGGER IF NOT EXISTS check_permission_mapping_action_allowed_for_type_insert
    BEFORE INSERT ON permission_mapping
    FOR EACH ROW
    WHEN NOT EXISTS (
        SELECT 1
        FROM permission_target pt
        JOIN permission_allowed_action_by_type paabt
            ON pt.permission_type_id = paabt.permission_type_id
        WHERE pt.id = NEW.permission_target_id
            AND paabt.permission_action_id = NEW.permission_action_id
    )
BEGIN
    SELECT RAISE(ABORT, 'permission_action is not allowed for this permission_type');
END;

CREATE TRIGGER IF NOT EXISTS check_permission_mapping_action_allowed_for_type_update
    BEFORE UPDATE ON permission_mapping
    FOR EACH ROW
    WHEN NOT EXISTS (
        SELECT 1
        FROM permission_target pt
        JOIN permission_allowed_action_by_type paabt
            ON pt.permission_type_id = paabt.permission_type_id
        WHERE pt.id = NEW.permission_target_id
            AND paabt.permission_action_id = NEW.permission_action_id
    )
BEGIN
    SELECT RAISE(ABORT, 'permission_action is not allowed for this permission_type');
END;

--- DATA INSERTION
-- permission_type data ('global', 'datastore', 'datastore.table', 'datastore.column')

INSERT INTO permission_type (id, i18n_title, i18n_description) VALUES
    ('global', '{ "en": "Global permission", "de": "Globale Berechtigung" }', '{ "en": "Top level permission", "de": "Top level permission" }'),
    ('datastore', '{ "en": "Datastore permission", "de": "Datenspeicher Berechtigung" }', '{ "en": "Datastore permission", "de": "Datenspeicher Berechtigung" }'),
    ('datastore.table', '{ "en": "Datastore table permission", "de": "Datenspeicher Tabelle Berechtigung" }', '{ "en": "Datastore table permission", "de": "Datenspeicher Tabelle Berechtigung" }'),
    ('datastore.table.column', '{ "en": "Datastore column permission", "de": "Datenspeicher Spalte Berechtigung" }', '{ "en": "Datastore column permission", "de": "Datenspeicher Spalte Berechtigung" }');

-- permission_action data 
INSERT INTO permission_action (id, i18n_title, i18n_description) VALUES
    ('datastore.create', '{ "en": "Create datastore", "de": "Datenspeicher erstellen" }', '{ "en": "Allow creating a new datastore", "de": "Erlaube das Erstellen eines neuen Datenspeichers" }'),
    ('datastore.list', '{ "en": "List datastores", "de": "Datenspeicher auflisten" }', '{ "en": "Allow listing this datastore", "de": "Erlaube das Auflisten dieses Datenspeichers" }'),
    ('datastore.rename', '{ "en": "Rename datastore", "de": "Datenspeicher umbenennen" }', '{ "en": "Allow renaming this datastore", "de": "Erlaube das Umbenennen dieses Datenspeichers" }'),
    ('datastore.drop', '{ "en": "Drop datastore", "de": "Datenspeicher löschen" }', '{ "en": "Allow dropping this datastore", "de": "Erlaube das Löschen dieses Datenspeichers" }'),
    ('datastore.table.create', '{ "en": "Create table", "de": "Tabelle erstellen" }', '{ "en": "Allow creating a new table", "de": "Erlaube das Erstellen einer neuen Tabelle" }'),
    ('datastore.table.list', '{ "en": "List tables", "de": "Tabelle auflisten" }', '{ "en": "Allow listing this table", "de": "Erlaube das Auflisten dieser Tabelle" }'),
    ('datastore.table.rename', '{ "en": "Rename table", "de": "Tabelle umbenennen" }', '{ "en": "Allow renaming this table", "de": "Erlaube das Umbenennen dieser Tabelle" }'),
    ('datastore.table.drop', '{ "en": "Drop table", "de": "Tabelle löschen" }', '{ "en": "Allow dropping this table", "de": "Erlaube das Löschen dieser Tabelle" }'),
    ('datastore.table.schema.change', '{ "en": "Change table schema", "de": "Tabelle Schema ändern" }', '{ "en": "Allow changing the schema of this table", "de": "Erlaube das Ändern des Schemas dieser Tabelle" }'),
    ('datastore.table.row.insert', '{ "en": "Insert row", "de": "Zeile einfügen" }', '{ "en": "Allow inserting a new row", "de": "Erlaube das Einfügen einer neuen Zeile" }'),
    ('datastore.table.row.update', '{ "en": "Update row", "de": "Zeile aktualisieren" }', '{ "en": "Allow updating this row", "de": "Erlaube das Aktualisieren dieser Zeile" }'),
    ('datastore.table.row.delete', '{ "en": "Delete row", "de": "Zeile löschen" }', '{ "en": "Allow deleting this row", "de": "Erlaube das Löschen dieser Zeile" }'),
    ('datastore.table.row.select', '{ "en": "Select row", "de": "Zeile auswählen" }', '{ "en": "Allow selecting this row", "de": "Erlaube das Auswählen dieser Zeile" }'),
    ('datastore.table.column.rename', '{ "en": "Rename column", "de": "Spalte umbenennen" }', '{ "en": "Allow renaming this column", "de": "Erlaube das Umbenennen dieser Spalte" }'),
    ('datastore.table.column.drop', '{ "en": "Drop column", "de": "Spalte löschen" }', '{ "en": "Allow dropping this column", "de": "Erlaube das Löschen dieser Spalte" }'),
    ('datastore.table.column.insert', '{ "en": "Insert column", "de": "Spalte einfügen" }', '{ "en": "Allow inserting new row with this column", "de": "Erlaube das Einfügen einer neuen Zeile mit dieser Spalte" }'),
    ('datastore.table.column.update', '{ "en": "Update column", "de": "Spalte aktualisieren" }', '{ "en": "Allow updating this column", "de": "Erlaube das Aktualisieren dieser Spalte" }'),
    ('datastore.table.column.delete', '{ "en": "Delete column", "de": "Spalte löschen" }', '{ "en": "Allow deleting this column", "de": "Erlaube das Löschen dieser Spalte" }'),
    ('datastore.table.column.select', '{ "en": "Select column", "de": "Spalte auswählen" }', '{ "en": "Allow selecting this column", "de": "Erlaube das Auswählen dieser Spalte" }');

-- permission_allowed_action_by_type data
INSERT INTO permission_allowed_action_by_type (permission_type_id, permission_action_id) VALUES
    ('global', 'datastore.create'),
    ('datastore', 'datastore.list'),
    ('datastore', 'datastore.rename'),
    ('datastore', 'datastore.drop'),
    ('datastore', 'datastore.table.create'),
    ('datastore.table', 'datastore.table.list'),
    ('datastore.table', 'datastore.table.rename'),
    ('datastore.table', 'datastore.table.drop'),
    ('datastore.table', 'datastore.table.schema.change'),
    ('datastore.table', 'datastore.table.row.insert'),
    ('datastore.table', 'datastore.table.row.update'),
    ('datastore.table', 'datastore.table.row.delete'),
    ('datastore.table', 'datastore.table.row.select'),
    ('datastore.table.column', 'datastore.table.column.rename'),
    ('datastore.table.column', 'datastore.table.column.drop'),
    ('datastore.table.column', 'datastore.table.column.insert'),
    ('datastore.table.column', 'datastore.table.column.update'),
    ('datastore.table.column', 'datastore.table.column.delete'),
    ('datastore.table.column', 'datastore.table.column.select');