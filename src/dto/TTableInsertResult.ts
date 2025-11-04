/**
 * DTO for table insert operation result
 */
export type TTableInsertResult = {
  inserted: number;                // Number of rows inserted
  rows: Record<string, any>[];     // Inserted rows with all columns
};

/**
 * Converts insert result to DTO
 */
export function toTTableInsertResult(
  inserted: number,
  rows: Record<string, any>[]
): TTableInsertResult {
  return {
    inserted,
    rows
  };
}
