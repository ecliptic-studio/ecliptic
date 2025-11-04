/**
 * DTO for table data response with pagination metadata
 *
 * Uses cursor-based pagination (pageSize + offset) without expensive COUNT queries.
 * The `hasMore` flag indicates if there are more rows beyond the current page.
 */
export type TTableData = {
  data: ({_rowid: string} & Record<string, any>)[];
  pagination: {
    pageSize: number;   // Number of rows requested per page
    offset: number;     // Number of rows skipped (starting position)
    hasMore: boolean;   // True if there are more rows after this page
  };
  columns: string[];
};

/**
 * Converts raw table data to TTableData DTO with pagination metadata
 *
 * Uses the "pageSize + 1" technique to efficiently determine if more pages exist:
 * - Query fetches `pageSize + 1` rows
 * - If result has `pageSize + 1` rows, hasMore = true (and we return only `pageSize` rows)
 * - If result has ≤ `pageSize` rows, hasMore = false (this is the last page)
 *
 * @param data - Array of row objects from the database query (may contain pageSize + 1 rows)
 * @param pageSize - Number of records per page (requested by client)
 * @param offset - Number of records skipped
 * @param columns - Array of column names in the result
 * @returns TTableData DTO with data and pagination metadata
 */
export function toTTableData(
  data: Record<string, any>[],
  pageSize: number,
  offset: number,
  hasMore: boolean,
  columns: string[]
): TTableData {
  // Check if we got more rows than requested (indicates more pages exist)
  // If we have extra rows, remove the last one (it was only for hasMore detection)
  const actualData = hasMore ? data.slice(0, pageSize) : data;

  return {
    data: actualData as ({_rowid: string} & Record<string, any>)[],
    pagination: {
      pageSize,
      offset,
      hasMore
    },
    columns
  };
}
