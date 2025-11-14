import type { TSession } from "@dto/TSession";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import { deleteTableRowsTx } from "@server/subroutines/datastore/delete-table-rows.tx";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import type { TableSchema } from "@server/subroutines/datastore/validate-row-data.fn";
import Database from "bun:sqlite";

export type DeleteTableRowsArgs = {
  datastoreId: string;
  tableName: string;
  rowids: number[];   // Array of ROWIDs to delete
};

export type DeleteTableRowsControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for deleting rows from a datastore table by ROWID
 *
 * Steps:
 * 1. Fetch datastore from database
 * 2. Validate table exists in schema
 * 3. Validate rowids are provided
 * 4. Open database connection (read-write mode)
 * 5. Call delete subroutine
 * 6. Execute rollbacks on failure
 * 7. Return deleted row count
 */
export async function deleteTableRowsController(
  ctx: DeleteTableRowsControllerContext,
  args: DeleteTableRowsArgs
): Promise<TErrTuple<{ deleted: number }>> {
  const rollbacks: TExternalRollback[] = [];

  try {
    // Validate rowids are provided
    if (!args.rowids || args.rowids.length === 0) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_DELETE_NO_FILTERS)
        .internal('rowids array required for DELETE operation')
        .external({
          en: 'Delete operation requires at least one ROWID',
          de: 'Löschvorgang erfordert mindestens eine ROWID',
        })
        .statusCode(400)
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
        .statusCode(404)
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
        .statusCode(404)
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Step 4: Open database connection (read-write mode)
    const [database, dbError, dbRollbacks] = openDatastoreConnectionTx(
      { Database },
      { fileName: datastore.external_id, readOnly: false }
    );
    rollbacks.push(...dbRollbacks);

    if (dbError || !database) {
      await executeRollbacks(rollbacks);
      return [null, dbError || createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_DELETE_FAILED)
        .internal('Failed to open database connection')
        .external({
          en: 'Failed to access datastore',
          de: 'Fehler beim Zugriff auf Datastore',
        })
        .statusCode(500)
        .shouldLog(true)
        .buildEntry()
      ];
    }

    // Step 5: Call delete subroutine
    const [deleteResult, deleteError, deleteRollbacks] = deleteTableRowsTx(
      { db: database },
      {
        tableName: args.tableName,
        rowids: args.rowids,
      }
    );
    rollbacks.push(...deleteRollbacks);

    if (deleteError) {
      await executeRollbacks(rollbacks);

      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_DELETE_FAILED)
        .internal(`Delete failed: ${deleteError.internal}`)
        .external(deleteError.external || {
          en: 'Failed to delete rows',
          de: 'Fehler beim Löschen der Zeilen',
        })
        .statusCode(deleteError.statusCode || 500)
        .shouldLog(true)
        .buildEntry();
      return [null, err];
    }

    // Clean up: close database connection
    database.close();

    // Step 6: Convert to DTO and return
    return [{ deleted: deleteResult.deleted }, null];

  } catch (error) {
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_DELETE_FAILED)
      .internal(`Unexpected error: ${msg}`)
      .external({
        en: 'Failed to delete rows',
        de: 'Fehler beim Löschen der Zeilen',
      })
      .statusCode(500)
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
