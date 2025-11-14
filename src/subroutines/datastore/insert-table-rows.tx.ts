import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTriple, TExternalRollback } from "@server/error/error-code.types";
import type { Database } from "bun:sqlite";

export type InsertTableRowsPortal = {
  db: Database;
};

export type InsertTableRowsArgs = {
  tableName: string;
  rows: Record<string, any>[];  // Array of row objects to insert
};

export type InsertTableRowsResult = {
  inserted: number;
  rows: Record<string, any>[];  // Inserted rows with all columns
};

/**
 * Subroutine to insert one or more rows into a table
 *
 * Uses transactions for bulk inserts to ensure atomicity.
 * Returns inserted rows with all columns.
 *
 * @param portal - Portal with database connection
 * @param args - Insert parameters
 * @returns TErrTriple with insert result
 */
export function insertTableRowsTx(
  portal: InsertTableRowsPortal,
  args: InsertTableRowsArgs
): TErrTriple<InsertTableRowsResult> {
  const rollbacks: TExternalRollback[] = [];
  const { db } = portal;
  const { tableName, rows } = args;

  if (rows.length === 0) {
    const err = createError(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED)
      .internal('No rows provided for insert')
      .external({
        en: 'No rows to insert',
        de: 'Keine Zeilen zum Einfügen',
      })
      .statusCode(400)
      .shouldLog(false)
      .buildEntry();
    return [null, err, rollbacks];
  }

  try {
    // Get column names from first row (all rows must have same structure)
    const firstRow = rows[0];
    if (!firstRow) {
      const err = createError(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED)
        .internal('Empty rows array')
        .external({
          en: 'No rows to insert',
          de: 'Keine Zeilen zum Einfügen',
        })
        .statusCode(400)
        .shouldLog(false)
        .buildEntry();
      return [null, err, rollbacks];
    }

    const columns = Object.keys(firstRow);
    if (columns.length === 0) {
      const err = createError(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED)
        .internal('Row has no columns')
        .external({
          en: 'Invalid row data: no columns provided',
          de: 'Ungültige Zeilendaten: keine Spalten angegeben',
        })
        .statusCode(400)
        .shouldLog(false)
        .buildEntry();
      return [null, err, rollbacks];
    }

    const insertedRows: Record<string, any>[] = [];

    // Build INSERT query
    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.map(col => `"${col}"`).join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;

    // Prepare statement
    const stmt = db.prepare(insertQuery);

    // Use transaction for bulk inserts
    const insertTransaction = db.transaction((rowsToInsert: Record<string, any>[]) => {
      for (const row of rowsToInsert) {
        // Extract values in same order as columns
        const values = columns.map(col => row[col] ?? null);

        // Execute insert
        const result = stmt.run(...values);

        // Get the inserted row (including ROWID)
        const lastRowId = result.lastInsertRowid;

        // Fetch the complete inserted row
        const selectStmt = db.prepare(
          `SELECT *, ROWID as rowid FROM "${tableName}" WHERE ROWID = ?`
        );
        const insertedRow = selectStmt.get(lastRowId) as Record<string, any>;

        if (insertedRow) {
          insertedRows.push(insertedRow);
        }
      }
    });

    // Execute transaction
    insertTransaction(rows);

    return [
      {
        inserted: insertedRows.length,
        rows: insertedRows,
      },
      null,
      rollbacks,
    ];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED)
      .internal(`Failed to insert rows: ${msg}`)
      .external({
        en: 'Failed to insert rows',
        de: 'Fehler beim Einfügen der Zeilen',
      })
      .statusCode(500)
      .shouldLog(true)
      .buildEntry();
    return [null, err, rollbacks];
  }
}
