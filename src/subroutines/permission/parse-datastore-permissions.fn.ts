import type { ParsedPermissions, ParsedPermissionTarget, RawPermission, DatastoreAction, TableAction, ColumnAction, GlobalAction } from './types';

/**
 * These are hardcoded values for now.
 * Later implementations should fetch them from database
 * because user will be able to configure own actions and types
 */
const allowedActionByType = {
  global: new Set<GlobalAction>([
    'datastore.create',
  ]),
  datastore: new Set<DatastoreAction>([
    'datastore.list',
    'datastore.rename',
    'datastore.drop',
    'datastore.table.create',
  ]),
  table: new Set<TableAction>([
    'datastore.table.list',
    'datastore.table.rename',
    'datastore.table.drop',
    'datastore.table.schema.change',
    'datastore.table.row.insert',
    'datastore.table.row.update',
    'datastore.table.row.delete',
    'datastore.table.row.select',
  ]),
  column: new Set<ColumnAction>([
    'datastore.table.column.rename',
    'datastore.table.column.drop',
    'datastore.table.column.insert',
    'datastore.table.column.update',
    'datastore.table.column.delete',
    'datastore.table.column.select',
  ]),
}


/**
 * Parses a permission_target_id string into structured components
 *
 * Format: datastore:ID.table:NAME.column:NAME
 * Examples:
 * - "datastore:abc123" → { datastore: "abc123" }
 * - "datastore:*.table:users" → { datastore: "*", table: "users" }
 * - "datastore:abc.table:users.column:email" → { datastore: "abc", table: "users", column: "email" }
 *
 * @param targetId - The permission_target_id from the database
 * @returns Parsed target structure, or null if invalid format
 */
export function parsePermissionTarget(targetId: string): ParsedPermissionTarget | null {
  const parts = targetId.split('.');

  if (parts.length === 0 || parts.length > 3) {
    return null;
  }

  const result: ParsedPermissionTarget = {
    datastore: '*'
  };

  for (const part of parts) {
    if (part.startsWith('datastore:')) {
      result.datastore = part.substring('datastore:'.length);
    } else if (part.startsWith('table:')) {
      result.table = part.substring('table:'.length);
    } else if (part.startsWith('column:')) {
      result.column = part.substring('column:'.length);
    } else {
      // Invalid format
      return null;
    }
  }

  return result;
}

/**
 * Parses raw permissions from database into structured format for easy checking
 *
 * Implements "most permissive wins" logic:
 * - Wildcard permissions grant access to all resources at that level
 * - Specific permissions are unioned with wildcard permissions
 * - Uses Sets for O(1) action lookup
 *
 * @param permissions - Raw permissions from database query
 * @returns Structured permissions organized by scope
 */
export function parsePermissions(
  permissions: RawPermission[]
): ParsedPermissions {
  const result: ParsedPermissions = {
    global: {
      actions: new Set(),
    },
    datastores: {},
    wildcards: {
      allDatastores: new Set(),
      allTables: new Set(),
      allColumns: new Set(),
    }
  };


  for (const perm of permissions) {
    const target = parsePermissionTarget(perm.permission_target_id);

    if (!target) {
      // Skip malformed permission targets
      continue;
    }

    const action = perm.permission_action_id;

    // Check which type of action this is
    const isGlobalAction = allowedActionByType.global.has(action as GlobalAction);
    const isDatastoreAction = allowedActionByType.datastore.has(action as DatastoreAction);
    const isTableAction = allowedActionByType.table.has(action as TableAction);
    const isColumnAction = allowedActionByType.column.has(action as ColumnAction);

    // Global actions - only datastore.create
    if (isGlobalAction) {
      result.global.actions.add(action as GlobalAction);
      continue;
    }

    // Skip invalid actions
    if (!isDatastoreAction && !isTableAction && !isColumnAction) {
      continue;
    }

    // Handle wildcard permissions
    if (target.datastore === '*') {
      if (!target.table) {
        // datastore:* → applies to all datastores
        if (isDatastoreAction) {
          result.wildcards.allDatastores.add(action as DatastoreAction);
        }
      } else if (target.table === '*') {
        if (!target.column) {
          // datastore:*.table:* → applies to all tables
          if (isTableAction) {
            result.wildcards.allTables.add(action as TableAction);
          }
        } else if (target.column === '*') {
          // datastore:*.table:*.column:* → applies to all columns
          if (isColumnAction) {
            result.wildcards.allColumns.add(action as ColumnAction);
          }
        }
      }
    } else {
      // Specific datastore permission
      const datastoreId = target.datastore;

      if (!result.datastores[datastoreId]) {
        result.datastores[datastoreId] = {
          actions: new Set(),
          tables: {},
        };
      }

      if (!target.table) {
        // datastore:ID → datastore-level action
        if (isDatastoreAction) {
          result.datastores[datastoreId].actions.add(action as DatastoreAction);
        }
      } else if (target.table === '*') {
        // datastore:ID.table:* → applies to all tables in this datastore
        if (!target.column) {
          // datastore:ID.table:*
          if (isTableAction) {
            if (!result.datastores[datastoreId].allTables) {
              result.datastores[datastoreId].allTables = {
                actions: new Set()
              };
            }
            result.datastores[datastoreId].allTables.actions.add(action as TableAction);
          }
        } else if (target.column === '*') {
          // datastore:ID.table:*.column:* → applies to all columns in all tables of this datastore
          // We don't have a dedicated structure for this, so we skip it for now
          // In practice, this should be handled by checking allTables at the datastore level
          // when filtering columns
        }
      } else {
        // Specific table permission
        const tableName = target.table;

        if (!result.datastores[datastoreId].tables[tableName]) {
          result.datastores[datastoreId].tables[tableName] = {
            actions: new Set(),
            columns: {}
          };
        }

        if (!target.column) {
          // datastore:ID.table:NAME → table-level action
          if (isTableAction) {
            result.datastores[datastoreId].tables[tableName].actions.add(action as TableAction);
          }
        } else if (target.column === '*') {
          // datastore:ID.table:NAME.column:* → applies to all columns in this table
          if (isColumnAction) {
            if (!result.datastores[datastoreId].tables[tableName].allColumns) {
              result.datastores[datastoreId].tables[tableName].allColumns = {
                actions: new Set()
              };
            }
            result.datastores[datastoreId].tables[tableName].allColumns.actions.add(action as ColumnAction);
          }
        } else {
          // Specific column permission
          const columnName = target.column;

          if (isColumnAction) {
            if (!result.datastores[datastoreId].tables[tableName].columns[columnName]) {
              result.datastores[datastoreId].tables[tableName].columns[columnName] = {
                actions: new Set()
              };
            }

            // datastore:ID.table:NAME.column:COL → column-level action
            result.datastores[datastoreId].tables[tableName].columns[columnName].actions.add(action as ColumnAction);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Checks if a specific action is allowed for a datastore
 *
 * @param permissions - Parsed permissions
 * @param datastoreId - The datastore ID to check
 * @param action - The action to check (e.g., 'datastore.list')
 * @returns true if action is allowed
 */
export function hasDatastoreAction(
  permissions: ParsedPermissions,
  datastoreId: string,
  action: DatastoreAction
): boolean {
  // Check wildcard permissions first
  if (permissions.wildcards.allDatastores.has(action)) {
    return true;
  }

  // Check specific datastore permissions
  const datastore = permissions.datastores[datastoreId];
  if (datastore && datastore.actions.has(action)) {
    return true;
  }

  return false;
}

/**
 * Checks if a specific action is allowed for a table
 *
 * @param permissions - Parsed permissions
 * @param datastoreId - The datastore ID
 * @param tableName - The table name
 * @param action - The action to check (e.g., 'datastore.table.list')
 * @returns true if action is allowed
 */
export function hasTableAction(
  permissions: ParsedPermissions,
  datastoreId: string,
  tableName: string,
  action: TableAction
): boolean {
  // Check global wildcard permissions
  if (permissions.wildcards.allTables.has(action)) {
    return true;
  }

  // Check specific datastore permissions
  const datastore = permissions.datastores[datastoreId];
  if (datastore) {
    // Check datastore-scoped wildcard (datastore:ID.table:*)
    if (datastore.allTables?.actions.has(action)) {
      return true;
    }

    // Check specific table permissions
    const table = datastore.tables[tableName];
    if (table && table.actions.has(action)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a specific action is allowed for a column
 *
 * @param permissions - Parsed permissions
 * @param datastoreId - The datastore ID
 * @param tableName - The table name
 * @param columnName - The column name
 * @param action - The action to check (e.g., 'datastore.table.column.select')
 * @returns true if action is allowed
 */
export function hasColumnAction(
  permissions: ParsedPermissions,
  datastoreId: string,
  tableName: string,
  columnName: string,
  action: ColumnAction
): boolean {
  // Check global wildcard permissions
  if (permissions.wildcards.allColumns.has(action)) {
    return true;
  }

  // Check specific datastore and table permissions
  const datastore = permissions.datastores[datastoreId];
  if (datastore) {
    const table = datastore.tables[tableName];
    if (table) {
      // Check table-scoped wildcard (datastore:ID.table:NAME.column:*)
      if (table.allColumns?.actions.has(action)) {
        return true;
      }

      // Check specific column permissions
      const column = table.columns[columnName];
      if (column && column.actions.has(action)) {
        return true;
      }
    }
  }

  return false;
}
