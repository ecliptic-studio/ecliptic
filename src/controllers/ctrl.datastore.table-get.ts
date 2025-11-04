import type { TSession } from "@dto/TSession";
import { toTTableData, type TTableData } from "@dto/TTableData";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import type { TableFilter, TableSort } from "@server/subroutines/datastore/build-table-query.fn";
import { fetchTableDataFx } from "@server/subroutines/datastore/fetch-table-data.fx";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import Database from "bun:sqlite";

export type GetTableDataArgs = {
  datastoreId: string;
  tableName: string;
  filters: TableFilter[];
  sort?: TableSort[];
  pageSize: number;
  offset: number;
  columns?: string[];
};

export type TableDataControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for fetching table data with filtering, sorting, and pagination
 */
export async function getTableDataController(
  ctx: TableDataControllerContext,
  args: GetTableDataArgs
): Promise<TErrTuple<TTableData>> {
  const rollbacks: TExternalRollback[] = [];
  try {
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
    const schema = JSON.parse(datastore.schema_json);
    if (!schema.tables[args.tableName]) {
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

    // Step 4: Open database connection
    const [database, dbError, dbRollbacks] = openDatastoreConnectionTx(
      { Database },
      { fileName: datastore.external_id, readOnly: true }
    );
    rollbacks.push(...dbRollbacks);

    if (dbError || !database) {
      await executeRollbacks(rollbacks);
      return [null, dbError || createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_GET_FAILED)
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

    // Step 5: Call subroutine to fetch table data
    const [result, subroutineError, subroutineRollbacks] = fetchTableDataFx(
      { db: database },
      {
        tableName: args.tableName,
        filters: args.filters,
        sort: args.sort,
        pageSize: args.pageSize,
        offset: args.offset,
        columns: args.columns,
      }
    );
    rollbacks.push(...subroutineRollbacks);

    if (subroutineError) {
      await executeRollbacks(rollbacks);

      // Wrap subroutine error with controller context
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_GET_FAILED)
        .internal(`Subroutine error: ${subroutineError.internal}`)
        .external(subroutineError.external || {
          en: 'Failed to fetch table data',
          de: 'Fehler beim Abrufen der Tabellendaten',
        })
        .statusCode(subroutineError.statusCode || 'Internal Server Error')
        .shouldLog(true)
        .buildEntry();
      return [null, err];
    }

    // Step 6: Convert result to DTO
    const dto = toTTableData(
      result.data,      // May contain pageSize + 1 rows
      args.pageSize,    // Requested pageSize
      args.offset,
      result.hasMore,
      result.columns
    );

    // Clean up: close database connection
    database.close();

    return [dto, null];
  } catch (error) {
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_TABLE_GET_FAILED)
      .internal(`Unexpected error in getTableDataController: ${msg}`)
      .external({
        en: 'Failed to fetch table data',
        de: 'Fehler beim Abrufen der Tabellendaten',
      })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
