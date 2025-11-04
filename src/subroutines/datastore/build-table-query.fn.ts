/**
 * Pure function to build safe, parameterized SQLite queries from filter/sort/pagination parameters.
 *
 * This function generates SELECT queries with:
 * - WHERE clauses from filters (combined with AND logic)
 * - ORDER BY clauses from sort parameters
 * - LIMIT/OFFSET for pagination (uses pageSize + 1 for hasMore detection)
 * - Column selection (SELECT specific columns or *)
 * - SQL injection prevention via parameterized queries
 * - Column name validation against schema whitelist
 */

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

export type TableFilter = {
  column: string;
  operator: FilterOperator;
  value: any;
};

export type TableSort = {
  column: string;
  direction: 'ASC' | 'DESC';
};

export type BuildTableQueryArgs = {
  tableName: string;
  filters: TableFilter[];
  sort?: TableSort[];
  pageSize: number;
  offset: number;
  columns?: string[];
  validColumns: string[]; // Whitelist from schema
};

export type BuildTableQueryResult = {
  query: string;    // SELECT query with pageSize + 1 for hasMore detection
  params: any[];
};

/**
 * Validates that a column name is in the whitelist
 * @throws Error if column name is not valid
 */
function validateColumnName(column: string, validColumns: string[]): void {
  // Allow _rowid as a special case since it's always available in SQLite
  if (column === '_rowid') {
    return;
  }

  if (!validColumns.includes(column)) {
    throw new Error(`Invalid column name: "${column}". Column not found in table schema.`);
  }
}

/**
 * Validates that a table name doesn't contain invalid characters
 * @throws Error if table name contains invalid characters
 */
function validateTableName(tableName: string): void {
  // Allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
    throw new Error(`Invalid table name: "${tableName}". Table name can only contain letters, numbers, underscores, and hyphens.`);
  }
}

/**
 * Converts a filter operator to SQL syntax with parameter placeholder
 */
function operatorToSQL(operator: FilterOperator, paramCount: number): string {
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
    case 'ilike':
      // SQLite doesn't have native ILIKE, use LIKE with COLLATE NOCASE
      return 'LIKE ? COLLATE NOCASE';
    case 'in':
      // For IN operator, we need multiple placeholders
      // paramCount tells us how many values are in the array
      return `IN (${Array(paramCount).fill('?').join(', ')})`;
    case 'is':
      // IS operator for NULL, TRUE, FALSE checks (no placeholder for IS NULL)
      return 'IS ?';
    default:
      throw new Error(`Invalid filter operator: "${operator}"`);
  }
}

/**
 * Builds a safe, parameterized SQLite query from the provided parameters
 */
export function buildTableQueryFn(args: BuildTableQueryArgs): BuildTableQueryResult {
  const { tableName, filters, sort, pageSize, offset, columns, validColumns } = args;

  // Validate table name
  validateTableName(tableName);

  // Build SELECT clause
  let selectClause = 'SELECT ';
  if (columns && columns.length > 0) {
    // Validate all requested columns
    columns.forEach(field => validateColumnName(field, validColumns));
    // Quote column names to handle reserved keywords and special characters
    selectClause += columns.map(f => `"${f}"`).join(', ');
    // Always include rowid as _rowid
    selectClause += ', rowid AS _rowid';
  } else {
    // Select all columns plus rowid as _rowid
    selectClause += '*, rowid AS _rowid';
  }

  // Build FROM clause (quote table name)
  const fromClause = ` FROM "${tableName}"`;

  // Build WHERE clause
  const params: any[] = [];
  let whereClause = '';

  if (filters.length > 0) {
    const whereClauses: string[] = [];

    for (const filter of filters) {
      // Validate column name
      validateColumnName(filter.column, validColumns);

      // Map _rowid to rowid for filtering (SQLite's internal column)
      const columnName = filter.column === '_rowid' ? 'rowid' : filter.column;

      // Handle IN operator specially (array of values)
      if (filter.operator === 'in') {
        if (!Array.isArray(filter.value)) {
          throw new Error(`Filter operator "in" requires an array value for column "${filter.column}"`);
        }
        if (filter.value.length === 0) {
          throw new Error(`Filter operator "in" requires at least one value for column "${filter.column}"`);
        }

        const sqlOperator = operatorToSQL(filter.operator, filter.value.length);
        whereClauses.push(`"${columnName}" ${sqlOperator}`);
        params.push(...filter.value);
      } else {
        const sqlOperator = operatorToSQL(filter.operator, 1);
        whereClauses.push(`"${columnName}" ${sqlOperator}`);
        params.push(filter.value);
      }
    }

    whereClause = ' WHERE ' + whereClauses.join(' AND ');
  }

  // Build ORDER BY clause
  let orderByClause = '';
  if (sort && sort.length > 0) {
    // Validate all sort columns
    sort.forEach(s => validateColumnName(s.column, validColumns));

    const sortClauses = sort.map(s => `"${s.column}" ${s.direction}`);
    orderByClause = ' ORDER BY ' + sortClauses.join(', ');
  }

  // Build LIMIT/OFFSET clause (use pageSize + 1 for hasMore detection)
  const limitClause = ` LIMIT ? OFFSET ?`;
  params.push(pageSize + 1); // Query for one extra row to detect hasMore
  params.push(offset);

  // Combine all clauses
  const query = selectClause + fromClause + whereClause + orderByClause + limitClause;

  return { query, params };
}
