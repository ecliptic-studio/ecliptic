/**
 * Parsed permission target structure
 */
export type ParsedPermissionTarget = {
  datastore: string | '*';
  table?: string | '*';
  column?: string | '*';
};

export type GlobalAction = 'datastore.create'

/**
 * Available permission actions organized by scope
 */
export type DatastoreAction = 
  | 'datastore.list'
  | 'datastore.rename'
  | 'datastore.drop'
  | 'datastore.table.create'

export type TableAction =
  | 'datastore.table.list'
  | 'datastore.table.rename'
  | 'datastore.table.drop'
  | 'datastore.table.schema.change'
  | 'datastore.table.row.insert'
  | 'datastore.table.row.update'
  | 'datastore.table.row.delete'
  | 'datastore.table.row.select'

export type ColumnAction =
  | 'datastore.table.column.rename'
  | 'datastore.table.column.drop'
  | 'datastore.table.column.insert'
  | 'datastore.table.column.update'
  | 'datastore.table.column.delete'
  | 'datastore.table.column.select';

export type PermissionAction = GlobalAction | DatastoreAction | TableAction | ColumnAction;

/**
 * Parsed permissions organized by scope for easy checking
 * Uses Sets for O(1) action lookup
 */
export type ParsedPermissions = {
  /**
   * Global permissions that apply across all resources
   */
  global: {
    actions: Set<GlobalAction>;
  };
  /**
   * Permissions scoped to specific datastores
   */
  datastores: Record<string, {
    /**
     * Actions allowed at the datastore level
     * e.g., 'datastore.list', 'datastore.drop'
     */
    actions: Set<DatastoreAction>;
    /**
     * Actions granted on datastore:ID.table:*
     * These apply to ALL tables in THIS specific datastore
     */
    allTables?: {
      actions: Set<TableAction>;
    };
    /**
     * Permissions scoped to specific tables within this datastore
     */
    tables: Record<string, {
      /**
       * Actions allowed at the table level
       * e.g., 'datastore.table.list', 'datastore.table.drop'
       */
      actions: Set<TableAction>;
      /**
       * Actions granted on datastore:ID.table:NAME.column:*
       * These apply to ALL columns in THIS specific table
       */
      allColumns?: {
        actions: Set<ColumnAction>;
      };
      /**
       * Permissions scoped to specific columns within this table
       */
      columns: Record<string, {
        /**
         * Actions allowed at the column level
         * e.g., 'datastore.table.column.select'
         */
        actions: Set<ColumnAction>;
      }>;
    }>;
  }>;
  /**
   * Wildcard permissions that apply across all resources
   */
  wildcards: {
    /**
     * Actions granted on datastore:*
     * These apply to ALL datastores
     */
    allDatastores: Set<DatastoreAction>;
    /**
     * Actions granted on datastore:*.table:*
     * These apply to ALL tables in ALL datastores
     */
    allTables: Set<TableAction>;
    /**
     * Actions granted on datastore:*.table:*.column:*
     * These apply to ALL columns in ALL tables in ALL datastores
     */
    allColumns: Set<ColumnAction>;
  };
};

/**
 * Raw permission from database
 */
export type RawPermission = {
  permission_target_id: string;
  permission_action_id: string;
};

/**
 * Schema change operation extracted from DDL SQL
 */
export type TSchemaChangeOperation = {
  type: 'add-column',
  table: string,
  column: string,
  db_type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB',
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
 * Result from checking SQL permissions
 * Returns an array of results, one for each statement in the query
 */
export type SqlCheckResult =
  | { allowed: false; isDdl: false }
  | { allowed: true; isDdl: false }
  | { allowed: false; isDdl: true; operation: TSchemaChangeOperation }
  | { allowed: true; isDdl: true; operation: TSchemaChangeOperation };
