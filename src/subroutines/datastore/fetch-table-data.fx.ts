/**
 * Effectful function to fetch table data from a datastore with filtering, sorting, and pagination.
 *
 * This is an .fx.ts (effectful) subroutine that reads from a SQLite database.
 * It validates the table exists, builds a safe query, and executes it.
 *
 * @param portal - External dependencies (open Database connection)
 * @param args - Query parameters (table name, filters, sorting, pagination)
 * @returns TErrTriple with query results and column names
 */

import type { TErrTriple, TExternalRollback } from "@error/error-code.types";
import { createError } from "@error/t-error";
import { ErrorCode } from "@error/error-code.enum";
import type Database from "bun:sqlite";
import { buildTableQueryFn, type TableFilter, type TableSort } from "./build-table-query.fn";

export type FetchTableDataPortal = {
  db: Database; // Open database connection
};

export type FetchTableDataArgs = {
  tableName: string;
  filters: TableFilter[];
  sort?: TableSort[];
  pageSize: number;
  offset: number;
  columns?: string[];
};

export type FetchTableDataResult = {
  data: Record<string, any>[];
  columns: string[];
  hasMore: boolean;
};

type TableInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

export function fetchTableDataFx(
  portal: FetchTableDataPortal,
  args: FetchTableDataArgs
): TErrTriple<FetchTableDataResult> {
  const rollbacks: TExternalRollback[] = [];

  try {
    const db = portal.db;

    // Step 1: Validate table exists and get schema
    const tableInfoQuery = db.query<TableInfo, []>(
      `PRAGMA table_info("${args.tableName}");`
    );
    const tableInfo = tableInfoQuery.all();

    if (tableInfo.length === 0) {
      return [
        null,
        createError(ErrorCode.SR_DATASTORE_QUERY_BUILD_FAILED)
          .internal(`Table "${args.tableName}" not found in database`)
          .external({
            en: `Table '${args.tableName}' not found`,
            de: `Tabelle '${args.tableName}' nicht gefunden`,
          })
          .statusCode("Not Found")
          .shouldLog(false)
          .buildEntry(),
        rollbacks,
      ];
    }

    // Step 2: Extract valid column names from schema
    const validColumns = tableInfo.map((col) => col.name);

    // Step 3: Build query using the pure function
    let queryResult;
    try {
      queryResult = buildTableQueryFn({
        tableName: args.tableName,
        filters: args.filters,
        sort: args.sort,
        pageSize: args.pageSize,
        offset: args.offset,
        columns: args.columns,
        validColumns,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return [
        null,
        createError(ErrorCode.SR_DATASTORE_QUERY_BUILD_FAILED)
          .internal(`Failed to build query: ${msg}`)
          .external({
            en: "Invalid query parameters",
            de: "Ungültige Abfrageparameter",
          })
          .statusCode("Bad Request")
          .shouldLog(false)
          .buildEntry(),
        rollbacks,
      ];
    }

    // Step 4: Execute the SELECT query
    let data: Record<string, any>[];
    try {
      const stmt = db.query(queryResult.query);
      data = stmt.all(...queryResult.params) as Record<string, any>[];
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return [
        null,
        createError(ErrorCode.SR_DATASTORE_QUERY_EXECUTION_FAILED)
          .internal(`Failed to execute query: ${msg}`)
          .external({
            en: "Failed to fetch table data",
            de: "Tabellendaten konnten nicht abgerufen werden",
          })
          .statusCode("Internal Server Error")
          .shouldLog(true)
          .buildEntry(),
        rollbacks,
      ];
    }

    // Step 5: Extract column names from results (or construct from query if no results)
    let columns: string[];
    if (data.length > 0) {
      // Get column names from the first result row
      columns = data[0] ? Object.keys(data[0]) : [];
    } else if (args.columns && args.columns.length > 0) {
      // Use requested columns if specified, plus _rowid
      columns = [...args.columns, '_rowid'];
    } else {
      // Use all columns from schema, plus _rowid
      columns = [...validColumns, '_rowid'];
    }

    // Step 6: Check if there are more results and slice data to pageSize
    const hasMore = data.length > args.pageSize;
    const finalData = hasMore ? data.slice(0, args.pageSize ) : data;

    return [{ data: finalData, columns, hasMore }, null, rollbacks];
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return [
      null,
      createError(ErrorCode.SR_DATASTORE_QUERY_EXECUTION_FAILED)
        .internal(`Unexpected error in fetchTableDataFx: ${msg}`)
        .external({
          en: "Failed to fetch table data",
          de: "Tabellendaten konnten nicht abgerufen werden",
        })
        .statusCode("Internal Server Error")
        .shouldLog(true)
        .buildEntry(),
      rollbacks,
    ];
  }
}
