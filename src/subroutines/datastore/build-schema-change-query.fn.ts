
export type TDatastoreSchemaChange = {
  type: 'add-column',
  table: string,
  column: string,
  db_type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB',
  foreign_key?: {
    table: string,
    column: string,
  }
} | {
  type: 'drop-column',
  table: string,
  column: string,
} | {
  type: 'rename-column',
  table: string,
  column: string,
  new_name: string,
} | {
  type: 'rename-table',
  table: string,
  new_name: string,
} | {
  type: 'add-table',
  table: string,
} | {
  type: 'drop-table',
  table: string,
}

/**
 * Builds a query to change the schema of a datastore in sqlite
 *
 * This is a pure function (.fn.ts) that generates SQL DDL statements
 * for SQLite schema changes without any side effects.
 *
 * Supported operations:
 * - add-column: Add a new column to an existing table
 * - drop-column: Remove a column from a table
 * - rename-column: Rename an existing column
 * - rename-table: Rename an existing table
 * - add-table: Create a new table with a single _id column (INTEGER PRIMARY KEY)
 * - drop-table: Delete an existing table and all its data
 *
 * @param args - The schema change operation to perform
 * @returns A SQL query string and if possible a rollback query ready to be executed
 */
export function buildSchemaChangeQueryFn(args: TDatastoreSchemaChange): { query: string, rollback?: string } {
  switch (args.type) {
    case 'add-column': {
      // Build the column definition with optional foreign key constraint
      let columnDef = `"${args.column}" ${args.db_type}`;

      // Add foreign key reference if specified
      if (args.foreign_key) {
        columnDef += ` REFERENCES "${args.foreign_key.table}"(${args.foreign_key.column})`;
      }

      return {
        query: `ALTER TABLE "${args.table}" ADD COLUMN ${columnDef};`,
        rollback: `ALTER TABLE "${args.table}" DROP COLUMN "${args.column}";`
      };
    }

    case 'drop-column':
      return { query: `ALTER TABLE "${args.table}" DROP COLUMN "${args.column}";` };

    case 'rename-column':
      return { query: `ALTER TABLE "${args.table}" RENAME COLUMN "${args.column}" TO "${args.new_name}";`, rollback: `ALTER TABLE "${args.table}" RENAME COLUMN "${args.new_name}" TO "${args.column}";` };

    case 'rename-table':
      if(args.new_name === 'sqlite_sequence') throw new Error('sqlite_sequence is a special table and cannot be renamed');
      return { query: `ALTER TABLE "${args.table}" RENAME TO "${args.new_name}";`, rollback: `ALTER TABLE "${args.new_name}" RENAME TO "${args.table}";` };

    case 'add-table':
      if(args.table === 'sqlite_sequence') throw new Error('sqlite_sequence is a special table and cannot be created');
      // SQLite requires at least one column, so we create a table with a single dummy column
      // that can be dropped later if needed. Using INTEGER PRIMARY KEY leverages SQLite's rowid.
      return { query: `CREATE TABLE "${args.table}" (_id INTEGER PRIMARY KEY AUTOINCREMENT);`, rollback: `DROP TABLE "${args.table}";` };

    case 'drop-table':
      if(args.table === 'sqlite_sequence') throw new Error('sqlite_sequence is a special table and cannot be dropped');
      return { query: `DROP TABLE "${args.table}";` };

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = args;
      throw new Error(`Unknown schema change type: ${JSON.stringify(_exhaustive)}`);
  }
}