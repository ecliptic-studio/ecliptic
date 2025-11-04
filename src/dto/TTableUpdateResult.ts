/**
 * DTO for table update operation result
 */
export type TTableUpdateResult = {
  updated: number;  // Number of rows updated
  rows: Record<string, any>[];  // Updated rows with all columns (including _rowid)
};

/**
 * Converts update result to DTO
 */
export function toTTableUpdateResult(updated: number, rows: Record<string, any>[]): TTableUpdateResult {
  return { updated, rows };
}
