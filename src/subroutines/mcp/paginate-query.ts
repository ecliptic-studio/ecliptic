import { Parser } from "node-sql-parser";
import type { AST } from "node-sql-parser";

/**
 * Adds or replaces LIMIT and OFFSET clauses to SELECT queries.
 * Non-SELECT queries are returned unchanged.
 * Supports multiple SQL statements separated by semicolons.
 *
 * @param query - The SQL query string (single or multiple statements separated by semicolons)
 * @param limit - Maximum number of rows to return (default: 10 if no existing LIMIT)
 * @param offset - Number of rows to skip (default: 0)
 * @returns Array of SQL query strings (one per statement)
 */
export function paginateQueryFn(
  query: string,
  limit?: number,
  offset?: number
): string[] {
  const parser = new Parser();
  const opt = { database: 'sqlite' };

  try {
    // Parse SQL to AST (can be single AST or array of ASTs)
    const astResult = parser.astify(query, opt);

    // Handle array of ASTs (multiple statements)
    if (Array.isArray(astResult)) {
      const modifiedAsts = astResult.map((ast) => {
        return paginateSingleAst(ast, limit, offset);
      });

      // Check if any AST was modified
      const anyModified = modifiedAsts.some((result) => result.modified);

      // If nothing was modified, split original query by semicolon
      if (!anyModified) {
        return query.split(';').map(q => q.trim()).filter(q => q.length > 0);
      }

      // Convert modified ASTs back to SQL
      return modifiedAsts.map((result) => parser.sqlify(result.ast, opt));
    }

    // Handle single AST
    const result = paginateSingleAst(astResult, limit, offset);

    // If not modified, return original query as single-element array
    if (!result.modified) {
      return [query];
    }

    // Convert AST back to SQL
    return [parser.sqlify(result.ast, opt)];
  } catch (error) {
    // If parsing fails, return original query as single-element array
    return [query];
  }
}

/**
 * Helper function to paginate a single AST
 */
function paginateSingleAst(
  ast: AST,
  limit?: number,
  offset?: number
): { ast: AST; modified: boolean } {
  // Only paginate SELECT statements
  if (!ast || ast.type !== 'select') {
    return { ast, modified: false };
  }

  // Check if query already has LIMIT/OFFSET
  const hasLimit = ast.limit !== null && ast.limit !== undefined;

  // If no params provided and query has existing LIMIT, keep existing
  if (limit === undefined && offset === undefined && hasLimit) {
    return { ast, modified: false };
  }

  // Determine final limit and offset values
  const finalLimit = limit !== undefined ? limit : 10;
  const finalOffset = offset !== undefined ? offset : 0;

  // Modify AST to add/replace LIMIT and OFFSET
  // In node-sql-parser, OFFSET is part of the limit object
  ast.limit = {
    seperator: 'offset',
    value: [
      {
        type: 'number',
        value: finalLimit
      },
      {
        type: 'number',
        value: finalOffset
      }
    ]
  };

  return { ast, modified: true };
}
