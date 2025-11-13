import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTriple, TExternalRollback } from "@server/error/error-code.types";
import type { Database } from "bun:sqlite";
import type { TableFilter, FilterOperator } from "./build-table-query.fn";

export type UpdateTableRowsPortal = {
  db: Database;
};

export type UpdateTableRowsArgs = {
  tableName: string;
  set: Record<string, any>;      // Columns to update
  where: TableFilter[];          // WHERE clause filters
  validColumns: string[];        // Whitelist from schema
};

export type UpdateTableRowsResult = {
  updated: number;  // Number of rows updated (from db.changes)
  rows: Record<string, any>[];  // Updated rows with all columns
};

/**
 * Subroutine to update rows in a table
 *
 * Uses parameterized queries to prevent SQL injection.
 * Requires WHERE filters to prevent accidental full-table updates.
 *
 * @param portal - Portal with database connection
 * @param args - Update parameters
 * @returns TErrTriple with update result
 */
export function updateTableRowsTx(
  portal: UpdateTableRowsPortal,
  args: UpdateTableRowsArgs
): TErrTriple<UpdateTableRowsResult> {
  const rollbacks: TExternalRollback[] = [];
  const { db } = portal;
  const { tableName, set, where, validColumns } = args;
  validColumns.push('_rowid_');

  if (Object.keys(set).length === 0) {
    const err = createError(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED)
      .internal('No columns provided to update')
      .external({
        en: 'No columns to update',
        de: 'Keine Spalten zum Aktualisieren',
      })
      .statusCode(400)
      .shouldLog(false)
      .buildEntry();
    return [null, err, rollbacks];
  }

  if (where.length === 0) {
    const err = createError(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED)
      .internal('WHERE filters required for UPDATE to prevent full-table updates')
      .external({
        en: 'Update operation requires filters to prevent accidental mass updates',
        de: 'Aktualisierungsvorgang erfordert Filter, um versehentliche Massenaktualisierungen zu verhindern',
      })
      .statusCode(400)
      .shouldLog(false)
      .buildEntry();
    return [null, err, rollbacks];
  }

  try {
    // Validate table name
    if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      throw new Error(`Invalid table name: "${tableName}"`);
    }

    // Build SET clause
    const setColumns = Object.keys(set);
    const setClause = setColumns.map(col => {
      // Validate column name
      if (!validColumns.includes(col)) {
        throw new Error(`Invalid column name in SET: "${col}"`);
      }
      return `"${col}" = ?`;
    }).join(', ');
    const setParams = setColumns.map(col => set[col]);

    // Build WHERE clause
    const { whereClause, whereParams } = buildWhereClause(where, validColumns);

    // Build final query with RETURNING clause
    const query = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *, rowid AS _rowid`;
    const params = [...setParams, ...whereParams];

    // Execute update and get returning rows
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as Record<string, any>[];

    // Get number of changed rows
    const updated = rows.length;

    return [
      { updated, rows },
      null,
      rollbacks,
    ];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED)
      .internal(`Failed to update rows: ${msg}`)
      .external({
        en: 'Failed to update rows',
        de: 'Fehler beim Aktualisieren der Zeilen',
      })
      .statusCode(500)
      .shouldLog(true)
      .buildEntry();
    return [null, err, rollbacks];
  }
}

/**
 * Helper function to build WHERE clause from filters
 */
function buildWhereClause(
  filters: TableFilter[],
  validColumns: string[]
): { whereClause: string; whereParams: any[] } {
  const whereClauses: string[] = [];
  const whereParams: any[] = [];

  for (const filter of filters) {
    // Validate column name
    if (!validColumns.includes(filter.column)) {
      throw new Error(`Invalid column name in WHERE: "${filter.column}"`);
    }

    const operator = operatorToSQL(filter.operator, filter.value);
    whereClauses.push(`"${filter.column}" ${operator}`);

    // Handle 'in' operator (array of values)
    if (filter.operator === 'in') {
      if (!Array.isArray(filter.value)) {
        throw new Error(`Filter operator 'in' requires an array value`);
      }
      whereParams.push(...filter.value);
    } else {
      whereParams.push(filter.value);
    }
  }

  return {
    whereClause: whereClauses.join(' AND '),
    whereParams,
  };
}

/**
 * Converts a filter operator to SQL syntax
 */
function operatorToSQL(operator: FilterOperator, value: any): string {
  switch (operator) {
    case 'eq':
      return '= ?';
    case 'ne':
      return '!= ?';
    case 'gt':
      return '> ?';
    case 'gte':
      return '>= ?';
    case 'lt':
      return '< ?';
    case 'lte':
      return '<= ?';
    case 'like':
      return 'LIKE ?';
    case 'in':
      if (!Array.isArray(value)) {
        throw new Error('IN operator requires array value');
      }
      return `IN (${Array(value.length).fill('?').join(', ')})`;
    default:
      throw new Error(`Invalid filter operator: "${operator}"`);
  }
}
