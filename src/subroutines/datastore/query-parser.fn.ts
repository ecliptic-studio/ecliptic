import type { FilterOperator, TableFilter, TableSort } from "./build-table-query.fn";

/**
 * Parsed query parameters from PostgREST syntax
 */
export type ParsedQuery = {
  filters: TableFilter[];
  select?: string[];
  order?: TableSort[];
  limit?: number;
  offset?: number;
};

/**
 * Parse all query parameters from PostgREST syntax into structured format
 * Supports:
 * - Horizontal filtering: ?column=operator.value
 * - Vertical filtering: ?select=col1,col2,col3
 * - Ordering: ?order=col1.asc,col2.desc.nullsfirst
 * - Pagination: ?limit=10&offset=20
 * - Logical operators: ?or=(...), ?and=(...), ?not.operator=(...)
 *
 * @param query - URL query parameters as Record<string, string>
 * @returns Parsed query structure with filters, select, order, limit, offset
 *
 * @example
 * parseQueryFn({
 *   age: 'gte.18',
 *   student: 'is.true',
 *   select: 'first_name,age',
 *   order: 'age.desc,height.asc',
 *   limit: '10'
 * })
 * // Returns: {
 * //   filters: [
 * //     { column: 'age', operator: 'gte', value: 18 },
 * //     { column: 'student', operator: 'is', value: true }
 * //   ],
 * //   select: ['first_name', 'age'],
 * //   order: [
 * //     { column: 'age', direction: 'DESC' },
 * //     { column: 'height', direction: 'ASC' }
 * //   ],
 * //   limit: 10
 * // }
 */
export function parseQueryFn(query: Record<string, any>): ParsedQuery {
  const result: ParsedQuery = {
    filters: []
  };

  // Parse each query parameter
  for (const [key, value] of Object.entries(query)) {
    const strValue = String(value);

    // Handle select parameter (vertical filtering)
    if (key === 'select') {
      result.select = parseSelectFn(strValue);
      continue;
    }

    // Handle order parameter
    if (key === 'order') {
      result.order = parseOrderFn(strValue);
      continue;
    }

    // Handle limit parameter
    if (key === 'limit') {
      const limit = parseInt(strValue, 10);
      if (!isNaN(limit) && limit > 0) {
        result.limit = limit;
      }
      continue;
    }

    // Handle offset parameter
    if (key === 'offset') {
      const offset = parseInt(strValue, 10);
      if (!isNaN(offset) && offset >= 0) {
        result.offset = offset;
      }
      continue;
    }

    // Handle logical operators (or, and, not) - skip for now (future enhancement)
    if (key === 'or' || key === 'and' || key.startsWith('or(') || key.startsWith('and(') || key.startsWith('not.')) {
      continue;
    }

    // Handle horizontal filters (column=operator.value)
    const filter = parseFilterFn(key, strValue);
    if (filter) {
      result.filters.push(filter);
    }
  }

  return result;
}

/**
 * Parse a single filter parameter from PostgREST syntax
 * Supports all PostgREST operators: eq, gt, gte, lt, lte, neq, like, ilike, in, is, match, imatch, fts, etc.
 *
 * @param column - Column name
 * @param value - Filter value in format "operator.value"
 * @returns TableFilter object or null if not a valid filter
 */
export function parseFilterFn(column: string, value: string): TableFilter | null {
  // All supported PostgREST operators
  const operatorPattern = /^(eq|gt|gte|lt|lte|neq|like|ilike|match|imatch|in|is|isdistinct|fts|plfts|phfts|wfts|cs|cd|ov|sl|sr|nxr|nxl|adj|not|or|and|all|any)\.(.*)$/;

  const match = value.match(operatorPattern);
  if (!match) {
    return null;
  }

  let operator = match[1];
  let filterValue: any = match[2];

  // Map PostgREST operators to our supported operators
  // Currently we support a subset - extend as needed
  const supportedOps: Record<string, FilterOperator> = {
    'eq': 'eq',
    'gt': 'gt',
    'gte': 'gte',
    'lt': 'lt',
    'lte': 'lte',
    'neq': 'ne',
    'like': 'like',
    'ilike': 'ilike',
    'in': 'in',
    'is': 'is'
  };

  // Check if operator is supported
  if (!supportedOps[operator as keyof typeof supportedOps]) {
    // Unsupported operators are ignored for now
    return null;
  }

  const normalizedOperator = supportedOps[operator as keyof typeof supportedOps]!;

  // Parse value based on operator
  filterValue = parseFilterValue(normalizedOperator, filterValue);

  return {
    column,
    operator: normalizedOperator,
    value: filterValue
  };
}

/**
 * Parse filter value based on operator type
 */
function parseFilterValue(operator: FilterOperator, value: string): any {
  // Handle 'in' operator - parse (val1,val2,val3) or ("val1","val2","val3")
  if (operator === 'in') {
    // Remove outer parentheses
    const cleanValue = value.replace(/^\(|\)$/g, '');

    // Split by comma, handling quoted strings
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < cleanValue.length; i++) {
      const char = cleanValue[i];

      if (char === '"' && (i === 0 || cleanValue[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last value
    if (current) {
      values.push(current.trim());
    }

    // Remove quotes from each value and parse
    return values.map(v => {
      // Remove surrounding quotes
      const unquoted = v.replace(/^"(.*)"$/, '$1');
      return parseScalarValue(unquoted);
    });
  }

  // Handle 'is' operator special values
  if (operator === 'is') {
    if (value === 'null' || value === 'not.null') {
      return null;
    } else if (value === 'true') {
      return true;
    } else if (value === 'false') {
      return false;
    } else if (value === 'unknown') {
      return undefined;
    }
  }

  // Handle LIKE wildcards - convert * to %
  if (operator === 'like' || operator === 'ilike') {
    return value.replace(/\*/g, '%');
  }

  // Parse scalar value (try to infer type)
  return parseScalarValue(value);
}

/**
 * Parse a scalar value, attempting to infer its type
 */
function parseScalarValue(value: string): any {
  // Try to parse as number
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null
  if (value === 'null') return null;

  // String (default)
  return value;
}

/**
 * Parse select parameter (vertical filtering)
 * Supports: ?select=col1,col2,alias:col3
 *
 * @param select - Comma-separated list of columns
 * @returns Array of column names (aliases are currently stripped)
 */
export function parseSelectFn(select: string): string[] {
  return select
    .split(',')
    .map(col => col.trim())
    .filter(col => col.length > 0)
    .map(col => {
      // Handle aliases (fullName:full_name -> full_name)
      // But not casting syntax (salary::text)
      // Check if there's a colon that's not part of ::
      const colonMatch = col.match(/^([^:]+):([^:].*)$/);
      if (colonMatch) {
        // This is an alias (single colon followed by non-colon)
        return colonMatch[2]?.trim() ?? '';
      }

      // Handle arrow operators for JSON/composite columns
      // and casting syntax (::)
      // For now, we'll keep the full expression as-is
      // e.g., "json_data->phones->0->>number" stays as-is
      // e.g., "salary::text" stays as-is
      return col;
    });
}

/**
 * Parse order parameter
 * Supports: ?order=col1.asc,col2.desc,col3.desc.nullslast
 *
 * @param order - Comma-separated list of order clauses
 * @returns Array of TableSort objects
 */
export function parseOrderFn(order: string): TableSort[] {
  if (!order || order.trim().length === 0) {
    return [];
  }

  return order
    .split(',')
    .map(clause => {
      const trimmed = clause.trim();
      if (trimmed.length === 0) return null;

      const parts = trimmed.split('.');
      if (parts.length === 0) return null;

      const column = parts[0];
      if (!column || column.length === 0) return null;

      let direction: 'ASC' | 'DESC' = 'ASC'; // Default to ascending

      // Check for direction
      if (parts.length > 1) {
        const dir = parts[1]?.toLowerCase() ?? '';
        if (dir === 'desc') {
          direction = 'DESC';
        } else if (dir === 'asc') {
          direction = 'ASC';
        }
      }

      // TODO: Handle nullsfirst/nullslast (parts[2])
      // For now, we ignore it as SQLite has different NULL handling

      return { column, direction };
    })
    .filter((sort): sort is TableSort => sort !== null);
}