import { Parser, type TableColumnAst } from "node-sql-parser";
import type { ColumnAction, DatastoreAction, ParsedPermissions, SqlCheckResult, TableAction, TSchemaChangeOperation } from "./types";

/**
 * Extracts table name and operation from parser format "select::null::tableName"
 */
function extractTableInfo(tableEntry: string): { operation: string; table: string } {
  const parts = tableEntry.split("::");
  return {
    operation: parts[0] || "",
    table: parts[parts.length - 1] || ""
  };
}

/**
 * Extracts column name, optional table name, and operation type from parser format
 * "select::null::(columnName)" -> { operation: "select", table: null, column: "columnName" }
 * "select::tableName::columnName" -> { operation: "select", table: "tableName", column: "columnName" }
 * "update::null::name" -> { operation: "update", table: null, column: "name" }
 */
function extractColumnInfo(columnEntry: string): { operation: string; table: string | null; column: string } {
  const parts = columnEntry.split("::");
  if (parts.length < 3) {
    return { operation: "", table: null, column: "" };
  }

  const operation = parts[0] || "";
  const tablePart = parts[1];
  const columnPart = parts[2] || "";

  // If table part is "null", it means no table qualification
  const table = tablePart === "null" ? null : tablePart || null;

  // Remove parentheses from column name: "(.*)" -> "*", "(columnName)" -> "columnName"
  const column = columnPart.replace(/[()]/g, "");

  return { operation, table, column };
}

/**
 * Checks if a specific table access is allowed
 */
function isTableAccessAllowed(
  tableName: string,
  datastoreId: string,
  pdp: ParsedPermissions,
  action: string // e.g., 'datastore.table.row.select'
): boolean {
  // Check wildcard permissions for all tables in all datastores
  if (pdp.wildcards.allTables.has(action as TableAction)) {
    return true;
  }

  // Check if datastore exists in permissions
  const datastorePerms = pdp.datastores[datastoreId];
  if (!datastorePerms) {
    return false;
  }

  // Check wildcard permissions for all tables in this specific datastore
  if (datastorePerms.actions.has(action as DatastoreAction)) {
    return true;
  }

  // Check specific table permissions
  const tablePerms = datastorePerms.tables[tableName];
  if (!tablePerms) {
    return false;
  }

  return tablePerms.actions.has(action as TableAction);
}

/**
 * Checks if column access is allowed
 */
function isColumnAccessAllowed(
  tableName: string,
  columnName: string,
  datastoreId: string,
  pdp: ParsedPermissions,
  action: ColumnAction // e.g., 'datastore.table.column.select'
): boolean {
  // Check wildcard permissions for all columns in all tables in all datastores
  if (pdp.wildcards.allColumns.has(action)) {
    return true;
  }

  // Check if datastore exists in permissions
  const datastorePerms = pdp.datastores[datastoreId];
  if (!datastorePerms) {
    return false;
  }

  // Check specific table permissions
  const tablePerms = datastorePerms.tables[tableName];
  if (!tablePerms) {
    return false;
  }

  // Check if there's an allColumns permission for this table
  if (tablePerms.allColumns && tablePerms.allColumns.actions.has(action)) {
    return true;
  }

  // Check if there's a wildcard column permission for this table
  const wildcardColumn = tablePerms.columns?.["*"];
  if (wildcardColumn && wildcardColumn.actions.has(action)) {
    return true;
  }

  // If column is *, we've already checked global and table-level wildcards above
  // If we reach here and column is *, it means no wildcard permission exists
  if (columnName === "*" || columnName === ".*") {
    return false;
  }

  // Check specific column permissions
  const columnPerms = tablePerms.columns?.[columnName];
  if (!columnPerms) {
    return false;
  }

  return columnPerms.actions.has(action);
}

function checkSelectStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  // Extract table info from parser format
  const tableInfoList = ast.tableList.map(extractTableInfo);
  const tables = tableInfoList.map(t => t.table);

  // Check if all tables have row.select permission
  for (const table of tables) {
    if (!isTableAccessAllowed(table, datastoreId, pdp, 'datastore.table.row.select')) {
      return false;
    }
  }

  // Extract column info (table and column name) from parser format
  const columnInfoList = ast.columnList.map(extractColumnInfo);

  // Check if all columns have column.select permission
  for (const columnInfo of columnInfoList) {
    const { table: qualifiedTable, column } = columnInfo;

    if (qualifiedTable) {
      // Column is qualified with a specific table (e.g., users.name)
      // Only check permission for that specific table
      if (!isColumnAccessAllowed(qualifiedTable, column, datastoreId, pdp, 'datastore.table.column.select')) {
        return false;
      }
    } else {
      // Column is not qualified (e.g., SELECT * or SELECT name)
      // Check permission against all tables in the query
      for (const table of tables) {
        if (!isColumnAccessAllowed(table, column, datastoreId, pdp, 'datastore.table.column.select')) {
          return false;
        }
      }
    }
  }

  return true;
}

function checkInsertStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  // Extract table info from parser format
  const tableInfoList = ast.tableList.map(extractTableInfo);

  // INSERT should only have one table
  if (tableInfoList.length !== 1) {
    return false;
  }

  const table = tableInfoList[0]!.table;

  // Check if table has row.insert permission
  if (!isTableAccessAllowed(table, datastoreId, pdp, 'datastore.table.row.insert')) {
    return false;
  }

  // Extract column info from parser format
  const columnInfoList = ast.columnList.map(extractColumnInfo);

  // Check if all columns have column.insert permission
  for (const columnInfo of columnInfoList) {
    const { column } = columnInfo;

    if (!isColumnAccessAllowed(table, column, datastoreId, pdp, 'datastore.table.column.insert')) {
      return false;
    }
  }

  return true;
}

function checkUpdateStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  // Extract table info from parser format
  const tableInfoList = ast.tableList.map(extractTableInfo);

  // Find the target table (marked with update operation)
  const updateTable = tableInfoList.find(t => t.operation === 'update');
  if (!updateTable) {
    return false;
  }

  const targetTable = updateTable.table;

  // Check if target table has row.update permission
  if (!isTableAccessAllowed(targetTable, datastoreId, pdp, 'datastore.table.row.update')) {
    return false;
  }

  // Check select permission on tables used in FROM/JOIN/subqueries
  for (const tableInfo of tableInfoList) {
    if (tableInfo.operation === 'select') {
      if (!isTableAccessAllowed(tableInfo.table, datastoreId, pdp, 'datastore.table.row.select')) {
        return false;
      }
    }
  }

  // Extract column info from parser format
  const columnInfoList = ast.columnList.map(extractColumnInfo);

  // Check column permissions based on operation type
  for (const columnInfo of columnInfoList) {
    const { operation, table: qualifiedTable, column } = columnInfo;

    // Determine the table to check against
    const tableToCheck = qualifiedTable || targetTable;

    // Check permission based on operation type from parser
    if (operation === 'update') {
      // Column in SET clause - needs update permission
      if (!isColumnAccessAllowed(tableToCheck, column, datastoreId, pdp, 'datastore.table.column.update')) {
        return false;
      }
    } else if (operation === 'select') {
      // Column in WHERE/FROM clause - needs select permission
      if (!isColumnAccessAllowed(tableToCheck, column, datastoreId, pdp, 'datastore.table.column.select')) {
        return false;
      }
    }
  }

  return true;
}

function checkDeleteStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  // Extract table info from parser format
  const tableInfoList = ast.tableList.map(extractTableInfo);

  // Find the target table (marked with delete operation)
  const deleteTable = tableInfoList.find(t => t.operation === 'delete');
  if (!deleteTable) {
    return false;
  }

  const targetTable = deleteTable.table;

  // Check if target table has row.delete permission
  if (!isTableAccessAllowed(targetTable, datastoreId, pdp, 'datastore.table.row.delete')) {
    return false;
  }

  // Check select permission on tables used in subqueries/WHERE clauses
  for (const tableInfo of tableInfoList) {
    if (tableInfo.operation === 'select') {
      if (!isTableAccessAllowed(tableInfo.table, datastoreId, pdp, 'datastore.table.row.select')) {
        return false;
      }
    }
  }

  // Extract column info from parser format
  const columnInfoList = ast.columnList.map(extractColumnInfo);

  // Get all tables involved (both target and subquery tables)
  const allTables = tableInfoList.map(t => t.table);

  // Check column permissions - only for columns used in WHERE/subquery clauses
  for (const columnInfo of columnInfoList) {
    const { operation, table: qualifiedTable, column } = columnInfo;

    // Skip the "delete::table::(.*)" entries - these are not actual column references
    if (operation === 'delete') {
      continue;
    }

    // All columns in DELETE WHERE/subquery clauses need select permission
    if (operation === 'select') {
      if (qualifiedTable) {
        // Column is qualified - check that specific table
        if (!isColumnAccessAllowed(qualifiedTable, column, datastoreId, pdp, 'datastore.table.column.select')) {
          return false;
        }
      } else {
        // Column is not qualified - it could belong to any table in the query
        // Check if it's accessible in at least one table
        let foundInAnyTable = false;
        for (const table of allTables) {
          if (isColumnAccessAllowed(table, column, datastoreId, pdp, 'datastore.table.column.select')) {
            foundInAnyTable = true;
            break;
          }
        }
        if (!foundInAnyTable) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Translates ALTER TABLE AST to schema change operation
 */
function translateAlterToSchemaChange(ast: TableColumnAst): TSchemaChangeOperation | null {
  if(ast.tableList.length === 0) {
    return null;
  }

  const tableInfoList = ast.tableList.map(extractTableInfo);
  if (tableInfoList.length !== 1) {
    return null;
  }

  const table = tableInfoList[0]!.table;
  const statement = (ast as any).ast;

  if (!statement.expr || !Array.isArray(statement.expr) || statement.expr.length === 0) {
    return null;
  }

  const expr = statement.expr[0];

  // ALTER TABLE ... RENAME TO ...
  if (expr.action === 'rename' && expr.resource === 'table') {
    return {
      type: 'rename-table',
      table,
      new_name: expr.table
    };
  }

  // ALTER TABLE ... RENAME COLUMN ... TO ...
  if (expr.action === 'rename' && expr.resource === 'column') {
    const oldColumnName = expr.old_column?.column;
    const newColumnName = expr.column?.column;
    if (oldColumnName && newColumnName) {
      return {
        type: 'rename-column',
        table,
        column: oldColumnName,
        new_name: newColumnName
      };
    }
  }

  // ALTER TABLE ... DROP COLUMN ...
  if (expr.action === 'drop' && expr.resource === 'column') {
    const columnName = expr.column?.column;
    if (columnName) {
      return {
        type: 'drop-column',
        table,
        column: columnName
      };
    }
  }

  // ALTER TABLE ... ADD COLUMN ...
  if (expr.action === 'add' && expr.resource === 'column') {
    const columnName = expr.column?.column;
    const dataType = expr.definition?.dataType?.toUpperCase();

    if (columnName && dataType) {
      // Map SQL types to SQLite types
      let db_type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' = 'TEXT';

      if (dataType.includes('INT')) {
        db_type = 'INTEGER';
      } else if (dataType.includes('REAL') || dataType.includes('FLOAT') || dataType.includes('DOUBLE') || dataType.includes('NUMERIC')) {
        db_type = 'REAL';
      } else if (dataType.includes('BLOB')) {
        db_type = 'BLOB';
      }

      return {
        type: 'add-column',
        table,
        column: columnName,
        db_type
      };
    }
  }

  return null;
}

/**
 * Translates CREATE TABLE AST to schema change operation
 */
function translateCreateTableToSchemaChange(ast: TableColumnAst): TSchemaChangeOperation | null {
  if(ast.tableList.length === 0) {
    return null;
  }

  const tableInfoList = ast.tableList.map(extractTableInfo);
  if (tableInfoList.length !== 1) {
    return null;
  }

  const table = tableInfoList[0]!.table;

  return {
    type: 'add-table',
    table
  };
}

/**
 * Translates DROP TABLE AST to schema change operation
 */
function translateDropTableToSchemaChange(ast: TableColumnAst): TSchemaChangeOperation | null {
  if(ast.tableList.length === 0) {
    return null;
  }

  const tableInfoList = ast.tableList.map(extractTableInfo);
  if (tableInfoList.length !== 1) {
    return null;
  }

  const table = tableInfoList[0]!.table;

  return {
    type: 'drop-table',
    table
  };
}

function checkAlterStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  // Extract table info from parser format
  const tableInfoList = ast.tableList.map(extractTableInfo);

  // ALTER should only have one table
  if (tableInfoList.length !== 1) {
    return false;
  }

  const table = tableInfoList[0]!.table;

  // Get the ALTER statement details from the AST
  const statement = (ast as any).ast;

  // Check if table has schema.change permission (required for all ALTER operations)
  if (!isTableAccessAllowed(table, datastoreId, pdp, 'datastore.table.schema.change')) {
    return false;
  }

  // Check for specific ALTER operations that require additional permissions
  if (statement.expr && Array.isArray(statement.expr)) {
    for (const expr of statement.expr) {
      // ALTER TABLE ... RENAME TO ...
      if (expr.action === 'rename' && expr.resource === 'table') {
        if (!isTableAccessAllowed(table, datastoreId, pdp, 'datastore.table.rename')) {
          return false;
        }
      }

      // ALTER TABLE ... RENAME COLUMN ... TO ...
      if (expr.action === 'rename' && expr.resource === 'column') {
        const columnName = expr.old_column?.column || expr.column?.column;
        if (columnName) {
          if (!isColumnAccessAllowed(table, columnName, datastoreId, pdp, 'datastore.table.column.rename')) {
            return false;
          }
        }
      }

      // ALTER TABLE ... DROP COLUMN ...
      if (expr.action === 'drop' && expr.resource === 'column') {
        const columnName = expr.column?.column;
        if (columnName) {
          if (!isColumnAccessAllowed(table, columnName, datastoreId, pdp, 'datastore.table.column.drop')) {
            return false;
          }
        }
      }

      // For ADD COLUMN, no specific permission beyond schema.change is needed
      // Other ALTER operations (MODIFY, etc.) are covered by schema.change
    }
  }

  return true;
}

function checkCreateTableStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  // Check if user has datastore.table.create permission
  const datastorePerms = pdp.datastores[datastoreId];

  if (pdp.wildcards.allDatastores.has('datastore.table.create')) {
    return true;
  }

  if (datastorePerms?.actions.has('datastore.table.create')) {
    return true;
  }

  return false;
}

function checkDropTableStatement(ast: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): boolean {
  if(ast.tableList.length === 0) {
    return false;
  }

  const tableInfoList = ast.tableList.map(extractTableInfo);
  if (tableInfoList.length !== 1) {
    return false;
  }

  const table = tableInfoList[0]!.table;

  // Check if table has drop permission
  if (!isTableAccessAllowed(table, datastoreId, pdp, 'datastore.table.drop')) {
    return false;
  }

  return true;
}

/**
 * Checks a single SQL statement against permissions
 */
function checkSingleStatement(parsedResult: TableColumnAst, pdp: ParsedPermissions, datastoreId: string): SqlCheckResult {
  const statement = (parsedResult as any).ast;

  if (!statement) {
    return { allowed: false, isDdl: false };
  }

  // Determine the statement type from the nested ast
  // DML statements (SELECT, INSERT, UPDATE, DELETE)
  if (statement.type === 'select') {
    const allowed = checkSelectStatement(parsedResult, pdp, datastoreId);
    return { allowed, isDdl: false };
  }

  if (statement.type === 'insert') {
    const allowed = checkInsertStatement(parsedResult, pdp, datastoreId);
    return { allowed, isDdl: false };
  }

  if (statement.type === 'update') {
    const allowed = checkUpdateStatement(parsedResult, pdp, datastoreId);
    return { allowed, isDdl: false };
  }

  if (statement.type === 'delete') {
    const allowed = checkDeleteStatement(parsedResult, pdp, datastoreId);
    return { allowed, isDdl: false };
  }

  // DDL statements (ALTER, CREATE, DROP)
  if (statement.type === 'alter') {
    const allowed = checkAlterStatement(parsedResult, pdp, datastoreId);
    const operation = translateAlterToSchemaChange(parsedResult);

    if (!operation) {
      return { allowed: false, isDdl: false };
    }

    return { allowed, isDdl: true, operation };
  }

  if (statement.type === 'create') {
    const allowed = checkCreateTableStatement(parsedResult, pdp, datastoreId);
    const operation = translateCreateTableToSchemaChange(parsedResult);

    if (!operation) {
      return { allowed: false, isDdl: false };
    }

    return { allowed, isDdl: true, operation };
  }

  if (statement.type === 'drop') {
    const allowed = checkDropTableStatement(parsedResult, pdp, datastoreId);
    const operation = translateDropTableToSchemaChange(parsedResult);

    if (!operation) {
      return { allowed: false, isDdl: false };
    }

    return { allowed, isDdl: true, operation };
  }

  // Statement type not yet supported
  return { allowed: false, isDdl: false };
}

export function checkSqlFn(sql: string, pdp: ParsedPermissions, datastoreId: string): SqlCheckResult[] {
  const parser = new Parser();
  const parsedResult = parser.parse(sql, { database: 'sqlite' });

  // The parser returns a TableColumnAst which has tableList, columnList, and ast properties
  // The ast property can be a single AST or an array of ASTs (for multiple statements)
  const astOrArray = (parsedResult as any).ast;

  if (!astOrArray) {
    return [];
  }

  // Handle both single statement and multiple statements
  const statements = Array.isArray(astOrArray) ? astOrArray : [astOrArray];

  // Check each statement individually
  // For multiple statements, we need to re-parse each one individually to get correct tableList/columnList
  const results: SqlCheckResult[] = statements.map((statement) => {
    if (statements.length > 1) {
      // Multiple statements: re-parse this specific statement to get its own tableList/columnList
      const statementSql = parser.sqlify(statement, { database: 'sqlite' });
      const individualParsedResult = parser.parse(statementSql, { database: 'sqlite' });
      return checkSingleStatement(individualParsedResult, pdp, datastoreId);
    } else {
      // Single statement: use the original parsed result
      const singleStatementResult = { ...parsedResult, ast: statement } as TableColumnAst;
      return checkSingleStatement(singleStatementResult, pdp, datastoreId);
    }
  });

  return results;
}