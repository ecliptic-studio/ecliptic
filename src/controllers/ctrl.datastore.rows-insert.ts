import type { TSession } from "@dto/TSession";
import { toTTableInsertResult, type TTableInsertResult } from "@dto/TTableInsertResult";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import { insertTableRowsTx } from "@server/subroutines/datastore/insert-table-rows.tx";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import { validateRowDataFn, type TableSchema } from "@server/subroutines/datastore/validate-row-data.fn";
import Database from "bun:sqlite";

export type InsertTableRowsArgs = {
  datastoreId: string;
  tableName: string;
  row?: Record<string, any>;      // Single row insert
  rows?: Record<string, any>[];   // Bulk insert
};

export type InsertTableRowsControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for inserting rows into a datastore table
 *
 * Steps:
 * 1. Fetch datastore from database
 * 2. Validate table exists in schema
 * 3. Validate row data against schema
 * 4. Open database connection (read-write mode)
 * 5. Call insert subroutine
 * 6. Execute rollbacks on failure
 * 7. Return inserted row count + data
 */
export async function insertTableRowsController(
  ctx: InsertTableRowsControllerContext,
  args: InsertTableRowsArgs
): Promise<TErrTuple<TTableInsertResult>> {
  const rollbacks: TExternalRollback[] = [];

  try {
    // Determine rows to insert (single row or multiple rows)
    const rowsToInsert = args.row ? [args.row] : args.rows;

    if (!rowsToInsert || rowsToInsert.length === 0) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_INSERT_FAILED)
        .internal('Either row or rows must be provided')
        .external({
          en: 'No data provided for insert',
          de: 'Keine Daten zum Einfügen bereitgestellt',
        })
        .statusCode('Bad Request')
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Step 1: Fetch datastore from database
    const datastore = await ctx.db
      .selectFrom('datastore')
      .where('id', '=', args.datastoreId)
      .where('organization_id', '=', ctx.session.activeOrganizationId)
      .selectAll()
      .executeTakeFirst();

    // Step 2: Validate datastore exists
    if (!datastore) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_NOT_FOUND)
        .internal(`Datastore ${args.datastoreId} not found`)
        .external({
          en: 'Datastore not found',
          de: 'Datastore nicht gefunden',
        })
        .statusCode('Not Found')
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Step 3: Parse schema and validate table exists
    const schema = JSON.parse(datastore.schema_json) as TableSchema;
    const tableSchema = schema.tables[args.tableName];

    if (!tableSchema) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_NOT_FOUND)
        .internal(`Table "${args.tableName}" not found in datastore ${args.datastoreId}`)
        .external({
          en: `Table '${args.tableName}' not found`,
          de: `Tabelle '${args.tableName}' nicht gefunden`,
        })
        .statusCode('Not Found')
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Step 4: Validate all rows against schema
    for (let i = 0; i < rowsToInsert.length; i++) {
      const row = rowsToInsert[i];
      if (!row) continue;

      const [validationResult, validationError] = validateRowDataFn({
        tableName: args.tableName,
        schema,
        rowData: row,
        operation: 'insert',
      });

      if (validationError) {
        const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_INSERT_INVALID_COLUMNS)
          .internal(`Validation failed for row ${i}: ${validationError.internal}`)
          .external(validationError.external || {
            en: `Invalid data in row ${i + 1}`,
            de: `Ungültige Daten in Zeile ${i + 1}`,
          })
          .statusCode('Bad Request')
          .shouldLog(false)
          .buildEntry();
        return [null, err];
      }
    }

    // Step 5: Open database connection (read-write mode)
    const [database, dbError, dbRollbacks] = openDatastoreConnectionTx(
      { Database },
      { fileName: datastore.external_id, readOnly: false }
    );
    rollbacks.push(...dbRollbacks);

    if (dbError || !database) {
      await executeRollbacks(rollbacks);
      return [null, dbError || createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_INSERT_FAILED)
        .internal('Failed to open database connection')
        .external({
          en: 'Failed to access datastore',
          de: 'Fehler beim Zugriff auf Datastore',
        })
        .statusCode('Internal Server Error')
        .shouldLog(true)
        .buildEntry()
      ];
    }

    // Step 6: Call insert subroutine
    const [insertResult, insertError, insertRollbacks] = insertTableRowsTx(
      { db: database },
      {
        tableName: args.tableName,
        rows: rowsToInsert,
      }
    );
    rollbacks.push(...insertRollbacks);

    if (insertError) {
      await executeRollbacks(rollbacks);

      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_INSERT_FAILED)
        .internal(`Insert failed: ${insertError.internal}`)
        .external(insertError.external || {
          en: 'Failed to insert rows',
          de: 'Fehler beim Einfügen der Zeilen',
        })
        .statusCode(insertError.statusCode || 'Internal Server Error')
        .shouldLog(true)
        .buildEntry();
      return [null, err];
    }

    // Clean up: close database connection
    database.close();

    // Step 7: Convert to DTO and return
    const dto = toTTableInsertResult(insertResult.inserted, insertResult.rows);
    return [dto, null];

  } catch (error) {
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_INSERT_FAILED)
      .internal(`Unexpected error: ${msg}`)
      .external({
        en: 'Failed to insert rows',
        de: 'Fehler beim Einfügen der Zeilen',
      })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
