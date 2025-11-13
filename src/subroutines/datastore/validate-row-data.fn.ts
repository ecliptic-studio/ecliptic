import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTriple } from "@server/error/error-code.types";

export type TableSchema = {
  tables: {
    [tableName: string]: {
      columns: {
        [columnName: string]: {
          name: string;
          order: number;
          db_type: string; // TEXT, INTEGER, REAL, BLOB
        };
      };
    };
  };
};

export type ValidateRowDataArgs = {
  tableName: string;
  schema: TableSchema;
  rowData: Record<string, any>;
  operation: 'insert' | 'update';
};

/**
 * Pure function to validate row data against table schema
 *
 * Validates:
 * - Column names exist in schema
 * - Data types are compatible with SQLite types
 *
 * @param args - Validation parameters
 * @returns TErrTriple with validation result
 */
export function validateRowDataFn(
  args: ValidateRowDataArgs
): TErrTriple<{ valid: true }> {
  const { tableName, schema, rowData, operation } = args;

  // Check table exists
  const tableSchema = schema.tables[tableName];
  if (!tableSchema) {
    const err = createError(ErrorCode.SR_DATASTORE_VALIDATE_ROW_DATA_FAILED)
      .internal(`Table "${tableName}" not found in schema`)
      .external({
        en: `Table '${tableName}' does not exist`,
        de: `Tabelle '${tableName}' existiert nicht`,
      })
      .statusCode(404)
      .shouldLog(false)
      .buildEntry();
    return [null, err, []];
  }

  // Validate columns
  const invalidColumns: string[] = [];
  const typeErrors: string[] = [];

  for (const [columnName, value] of Object.entries(rowData)) {
    // Check column exists in schema
    const columnSchema = tableSchema.columns?.[columnName];
    if (!columnSchema) {
      invalidColumns.push(columnName);
      continue;
    }

    // Skip null values (SQLite columns are nullable by default unless explicitly NOT NULL)
    if (value === null || value === undefined) {
      continue;
    }

    // Validate type compatibility
    const sqliteType = columnSchema.db_type;
    const jsType = typeof value;

    const isValid = validateTypeCompatibility(value, jsType, sqliteType);
    if (!isValid) {
      typeErrors.push(
        `Column '${columnName}' expects ${sqliteType} but got ${jsType} (value: ${JSON.stringify(value)})`
      );
    }
  }

  // Report errors if any
  if (invalidColumns.length > 0 || typeErrors.length > 0) {
    const errors = [
      ...(invalidColumns.length > 0
        ? [`Unknown columns: ${invalidColumns.join(', ')}`]
        : []),
      ...typeErrors,
    ];

    const err = createError(ErrorCode.SR_DATASTORE_VALIDATE_ROW_DATA_FAILED)
      .internal(`Validation failed for ${operation}: ${errors.join('; ')}`)
      .external({
        en: errors.join('. '),
        de: errors.join('. '),
      })
      .statusCode(400)
      .shouldLog(false)
      .buildEntry();
    return [null, err, []];
  }

  return [{ valid: true }, null, []];
}

/**
 * Helper function to validate JavaScript type compatibility with SQLite type
 */
function validateTypeCompatibility(
  value: any,
  jsType: string,
  sqliteType: string
): boolean {
  // Normalize SQLite type (handle variations like "TEXT", "VARCHAR", etc.)
  const normalizedType = sqliteType.toUpperCase();

  // TEXT types
  if (normalizedType.includes('TEXT') || normalizedType.includes('VARCHAR') || normalizedType.includes('CHAR')) {
    return jsType === 'string';
  }

  // INTEGER types
  if (normalizedType.includes('INT')) {
    return (
      jsType === 'number' &&
      Number.isInteger(value) &&
      Number.isFinite(value)
    );
  }

  // REAL/FLOAT types
  if (normalizedType.includes('REAL') || normalizedType.includes('FLOAT') || normalizedType.includes('DOUBLE')) {
    return jsType === 'number' && Number.isFinite(value);
  }

  // BLOB types
  if (normalizedType.includes('BLOB')) {
    return (
      Buffer.isBuffer(value) ||
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer ||
      jsType === 'string' // SQLite can accept strings as BLOB
    );
  }

  // Unknown type - accept any value
  return true;
}
