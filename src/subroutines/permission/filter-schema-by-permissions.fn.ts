import type { ParsedPermissions } from './types';
import { hasTableAction, hasColumnAction } from './parse-datastore-permissions.fn';

/**
 * Schema structure from TDatastore
 */
export type SchemaJson = {
  tables: Record<string, {
    columns: Record<string, {
      name: string;
      order: number;
      db_type: string;
    }>;
  }>;
};

/**
 * Filters a datastore schema based on parsed permissions
 *
 * Only returns tables and columns that the user has permission to access:
 * - Tables: Requires 'datastore.table.list' permission
 * - Columns: Requires 'datastore.table.column.select' permission
 *
 * Implements "most permissive wins":
 * - Wildcard permissions grant access to all resources
 * - Specific permissions grant access to specific resources
 * - Union of both
 *
 * @param schema - The full schema_json from a datastore
 * @param permissions - Parsed permissions for the user/MCP key
 * @param datastoreId - The ID of the datastore being filtered
 * @returns Filtered schema with accessible tables and their accessible columns (empty columns object if no column access)
 */
export function filterSchemaByPermissions(
  schema: SchemaJson,
  permissions: ParsedPermissions,
  datastoreId: string
): SchemaJson {
  const filteredTables: SchemaJson['tables'] = {};

  for (const [tableName, tableData] of Object.entries(schema.tables)) {
    // Check if user has permission to list this table
    const canListTable = hasTableAction(
      permissions,
      datastoreId,
      tableName,
      'datastore.table.list'
    );

    if (!canListTable) {
      // Skip this table entirely
      continue;
    }

    // Filter columns based on select permissions
    const filteredColumns: typeof tableData.columns = {};

    for (const [columnName, columnData] of Object.entries(tableData.columns)) {
      const canSelectColumn = hasColumnAction(
        permissions,
        datastoreId,
        tableName,
        columnName,
        'datastore.table.column.select'
      );

      if (canSelectColumn) {
        filteredColumns[columnName] = columnData;
      }
    }

    // Include table even if it has no accessible columns
    // This allows users to see table metadata for discovery purposes
    filteredTables[tableName] = {
      columns: filteredColumns
    };
  }

  return {
    tables: filteredTables
  };
}
