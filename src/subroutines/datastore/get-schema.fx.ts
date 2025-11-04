import type { TDatastore } from "@dto/TDatastore";
import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import type Database from "bun:sqlite";

export type DatastoreGetSchemaPortal = {
  db: Database;
};

type TableInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type ForeignKeyInfo = {
  id: number;
  seq: number;
  table: string; // Referenced table name
  from: string; // Column name in current table
  to: string; // Column name in referenced table
  on_update: string;
  on_delete: string;
  match: string;
};

/**
 * Gets the schema of a datastore database in the format expected by TDatastore
 *
 * This is a transactional subroutine (.tx.ts) that reads from a SQLite database
 * and returns the schema in a structured format.
 *
 * @param portal - External dependencies (Database constructor)
 * @param args - The file name of the database
 */
export function datastoreGetSchemaFx(
  portal: DatastoreGetSchemaPortal,
): TErrTuple<TDatastore['schema_json']> {

  try {
    // Open database connection directly without pooling for readonly operations
    // db = new portal.Database(args.fileName, { readonly: true, create: false });

    // Get all table names with their DDL (excluding SQLite internal tables)
    const tablesQuery = portal.db.query<{ name: string; sql: string }, []>(
      `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    );
    const tables = tablesQuery.all();

    // Build a map of tables with AUTOINCREMENT by parsing DDL
    const autoincrementTables = new Map<string, Set<string>>();
    for (const table of tables) {
      if (table.sql && table.sql.toUpperCase().includes('AUTOINCREMENT')) {
        // Parse which columns have AUTOINCREMENT
        // This is a simple check - AUTOINCREMENT must follow PRIMARY KEY
        const autoincrementColumns = new Set<string>();
        const lines = table.sql.split('\n');
        for (const line of lines) {
          if (line.toUpperCase().includes('AUTOINCREMENT')) {
            // Extract column name (first word after opening paren or start of line)
            const match = line.trim().match(/^\s*(\w+)\s+\w+\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i);
            if (match && match[1]) {
              autoincrementColumns.add(match[1]);
            }
          }
        }
        if (autoincrementColumns.size > 0) {
          autoincrementTables.set(table.name, autoincrementColumns);
        }
      }
    }

    const schema: TDatastore['schema_json'] = {
      tables: {}
    };

    // For each table, get column information and foreign keys
    for (const table of tables) {
      // PRAGMA doesn't support parameter binding, so we need to use string interpolation
      // The table name comes from sqlite_master, so it's safe
      const tableInfoQuery = portal.db.query<TableInfo, []>(
        `PRAGMA table_info("${table.name}");`
      );
      const columns = tableInfoQuery.all();

      // Get foreign key information for this table
      const foreignKeyQuery = portal.db.query<ForeignKeyInfo, []>(
        `PRAGMA foreign_key_list("${table.name}");`
      );
      const foreignKeys = foreignKeyQuery.all();

      // Build a map of column name to foreign key info
      const foreignKeyMap = new Map<string, ForeignKeyInfo>();
      for (const fk of foreignKeys) {
        foreignKeyMap.set(fk.from, fk);
      }

      schema.tables[table.name] = {
        columns: {}
      };

      // Build columns object with proper structure
      for (const column of columns) {
        const tableAutoincrementColumns = autoincrementTables.get(table.name);
        const isAutoincrement = tableAutoincrementColumns?.has(column.name) ?? false;
        const foreignKey = foreignKeyMap.get(column.name);

        schema.tables[table.name]!.columns[column.name] = {
          name: column.name,
          order: column.cid,
          db_type: column.type || 'TEXT', // Default to TEXT if type is empty
          dflt_value: column.dflt_value,
          notnull: column.notnull === 1,
          autoincrement: isAutoincrement,
          // Only include foreign_key if it exists
          ...(foreignKey ? {
            foreign_key: {
              table: foreignKey.table,
              column: foreignKey.to,
              on_update: foreignKey.on_update,
              on_delete: foreignKey.on_delete
            }
          } : {})
        };
      }
    }

    return [schema, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return [
      null,
      createError(ErrorCode.SR_DATASTORE_GET_SCHEMA_FAILED)
        .internal(`Failed to get schema: ${msg}`)
        .external({
          en: 'Failed to retrieve database schema',
          de: 'Datenbankschema konnte nicht abgerufen werden'
        })
        .statusCode('Internal Server Error')
        .shouldLog(true)
        .buildEntry(),
    ];
  }
}