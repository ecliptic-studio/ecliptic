import type { TSession } from "@dto/TSession";
import { toTTableUpdateResult, type TTableUpdateResult } from "@dto/TTableUpdateResult";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import type { TableFilter } from "@server/subroutines/datastore/build-table-query.fn";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import { updateTableRowsTx } from "@server/subroutines/datastore/update-table-rows.tx";
import { validateRowDataFn, type TableSchema } from "@server/subroutines/datastore/validate-row-data.fn";
import Database from "bun:sqlite";

export type UpdateTableRowsArgs = {
  datastoreId: string;
  tableName: string;
  set: Record<string, any>;   // Columns to update
  where: TableFilter[];       // WHERE clause filters
};

export type UpdateTableRowsControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for updating rows in a datastore table
 *
 * Steps:
 * 1. Fetch datastore from database
 * 2. Validate table exists in schema
 * 3. Validate WHERE filters are provided
 * 4. Validate SET data against schema
 * 5. Open database connection (read-write mode)
 * 6. Call update subroutine
 * 7. Execute rollbacks on failure
 * 8. Return updated row count
 */
export async function updateTableRowsController(
  ctx: UpdateTableRowsControllerContext,
  args: UpdateTableRowsArgs
): Promise<TErrTuple<TTableUpdateResult>> {
  const rollbacks: TExternalRollback[] = [];

  try {
    // Validate WHERE filters are provided
    if (!args.where || args.where.length === 0) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_UPDATE_NO_FILTERS)
        .internal('WHERE filters required for UPDATE to prevent full-table updates')
        .external({
          en: 'Update operation requires filters to prevent accidental mass updates',
          de: 'Aktualisierungsvorgang erfordert Filter',
        })
        .statusCode('Bad Request')
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Validate SET has columns
    if (!args.set || Object.keys(args.set).length === 0) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_UPDATE_FAILED)
        .internal('No columns provided to update')
        .external({
          en: 'No columns to update',
          de: 'Keine Spalten zum Aktualisieren',
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

    // Get valid column names from schema
    const validColumns = Object.keys(tableSchema.columns);

    // Step 4: Validate SET data against schema
    const [validationResult, validationError] = validateRowDataFn({
      tableName: args.tableName,
      schema,
      rowData: args.set,
      operation: 'update',
    });

    if (validationError) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_UPDATE_FAILED)
        .internal(`Validation failed for SET: ${validationError.internal}`)
        .external(validationError.external || {
          en: 'Invalid data in update',
          de: 'Ungültige Daten in Aktualisierung',
        })
        .statusCode('Bad Request')
        .shouldLog(false)
        .buildEntry();
      return [null, err];
    }

    // Step 5: Open database connection (read-write mode)
    const [database, dbError, dbRollbacks] = openDatastoreConnectionTx(
      { Database },
      { fileName: datastore.external_id, readOnly: false }
    );
    rollbacks.push(...dbRollbacks);

    if (dbError || !database) {
      await executeRollbacks(rollbacks);
      return [null, dbError || createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_UPDATE_FAILED)
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

    // Step 6: Call update subroutine
    const [updateResult, updateError, updateRollbacks] = updateTableRowsTx(
      { db: database },
      {
        tableName: args.tableName,
        set: args.set,
        where: args.where,
        validColumns,
      }
    );
    rollbacks.push(...updateRollbacks);

    if (updateError) {
      await executeRollbacks(rollbacks);

      return [null, updateError];
    }

    // Clean up: close database connection
    database.close();

    // Step 7: Convert to DTO and return
    const dto = toTTableUpdateResult(updateResult.updated, updateResult.rows);
    return [dto, null];

  } catch (error) {
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_UPDATE_FAILED)
      .internal(`Unexpected error: ${msg}`)
      .external({
        en: 'Failed to update rows',
        de: 'Fehler beim Aktualisieren der Zeilen',
      })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
