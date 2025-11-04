export type TableRow = Record<string, any> & {
  _rowid: string;  // SQLite's internal ROWID for identifying rows
};

export type ColumnSchema = {
  name: string;
  order: number;
  db_type: string;
  dflt_value?: string | null; // Default value from SQLite
  notnull?: boolean; // NOT NULL constraint
  autoincrement?: boolean; // AUTOINCREMENT detection
  foreign_key?: {
    table: string; // Referenced table name
    column: string; // Referenced column name (the "to" field)
    on_update: string; // ON UPDATE action
    on_delete: string; // ON DELETE action
  }; // Foreign key reference (only included if applicable)
};

export type DatastoreTableProps = {
  datastoreId: string;
  tableName: string;
};

export type CellCursor = {
  rowIndex: number;
  columnId: string;
};

export type CellEditState = {
  rowIndex: number;
  columnId: string;
  value: any;
  originalValue: any;
} | null;

export type PendingChange = {
  rowId: string;
  columnName: string;
  oldValue: any;
  newValue: any;
};

export type PendingChanges = PendingChange[];

/**
 * Metadata types for each dialog
 * Each dialog defines what context information it needs to operate
 */

export interface AddTableMetadata {
  datastoreId: string;
  tableName?: string;
}

export interface RenameTableMetadata {
  datastoreId: string;
  tableName: string;
}

export interface DeleteTableMetadata {
  datastoreId: string;
  tableName: string;
}

export interface DeleteDatastoreMetadata {
  datastoreId: string;
  datastoreName: string;
}

export interface AddColumnMetadata {
  datastoreId: string;
  tableName: string;
  dataType: "TEXT" | "INTEGER" | "REAL" | "BLOB";
}

export interface RenameColumnMetadata {
  datastoreId: string;
  tableName: string;
  columnName: string;
}

export interface DeleteColumnMetadata {
  datastoreId: string;
  tableName: string;
  columnName: string;
}

export interface RenameDatastoreMetadata {
  datastoreId: string;
  datastoreName: string;
}

/**
 * Dialog Registry - Maps dialog names to their metadata types
 * This is the source of truth for type-safe dialog operations
 */
export interface DatastoreDialogRegistry {
  addTable: AddTableMetadata;
  renameTable: RenameTableMetadata;
  deleteTable: DeleteTableMetadata;
  deleteDatastore: DeleteDatastoreMetadata;
  renameDatastore: RenameDatastoreMetadata;
  addColumn: AddColumnMetadata;
  renameColumn: RenameColumnMetadata;
  deleteColumn: DeleteColumnMetadata;
}

/**
 * Dialog names - extracted from registry keys
 */
export type DatastoreDialogName = keyof DatastoreDialogRegistry;

/**
 * Dialog state - tracks open/closed state and metadata for a dialog
 */
export interface DialogState<T = unknown> {
  open: boolean;
  metadata: T | null;
}

/**
 * Type-safe dialog opener - ensures metadata matches dialog name
 */
export type OpenDialogFn = <K extends DatastoreDialogName>(
  name: K,
  metadata: DatastoreDialogRegistry[K]
) => void;

/**
 * Close dialog function
 */
export type CloseDialogFn = (name: DatastoreDialogName) => void;
