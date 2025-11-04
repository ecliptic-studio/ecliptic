import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTriple, TExternalRollback } from "@server/error/error-code.types";
import type { Database } from "bun:sqlite";

export type DeleteTableRowsPortal = {
  db: Database;
};

export type DeleteTableRowsArgs = {
  tableName: string;
  rowids: number[];  // Array of ROWIDs to delete
};

export type DeleteTableRowsResult = {
  deleted: number;  // Number of rows deleted (from db.changes)
};

/**
 * Subroutine to delete rows from a table by ROWID
 *
 * Uses parameterized queries to prevent SQL injection.
 * Requires at least one ROWID to prevent accidental full-table deletes.
 *
 * @param portal - Portal with database connection
 * @param args - Delete parameters with rowids array
 * @returns TErrTriple with delete result
 */
export function deleteTableRowsTx(
  portal: DeleteTableRowsPortal,
  args: DeleteTableRowsArgs
): TErrTriple<DeleteTableRowsResult> {
  const rollbacks: TExternalRollback[] = [];
  const { db } = portal;
  const { tableName, rowids } = args;

  if (!rowids || rowids.length === 0) {
    const err = createError(ErrorCode.SR_DATASTORE_DELETE_ROWS_FAILED)
      .internal('rowids array required for DELETE to prevent full-table deletes')
      .external({
        en: 'Delete operation requires at least one ROWID',
        de: 'Löschvorgang erfordert mindestens eine ROWID',
      })
      .statusCode('Bad Request')
      .shouldLog(false)
      .buildEntry();
    return [null, err, rollbacks];
  }

  try {
    // Validate table name
    if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      throw new Error(`Invalid table name: "${tableName}"`);
    }

    // Build IN clause for ROWIDs
    const placeholders = Array(rowids.length).fill('?').join(', ');
    const query = `DELETE FROM "${tableName}" WHERE rowid IN (${placeholders})`;

    // Execute delete
    const stmt = db.prepare(query);
    const result = stmt.run(...rowids);

    // Get number of changed rows
    const deleted = result.changes;

    return [
      { deleted },
      null,
      rollbacks,
    ];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.SR_DATASTORE_DELETE_ROWS_FAILED)
      .internal(`Failed to delete rows: ${msg}`)
      .external({
        en: 'Failed to delete rows',
        de: 'Fehler beim Löschen der Zeilen',
      })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry();
    return [null, err, rollbacks];
  }
}
