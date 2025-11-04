export const SQLITE_DATA_TYPES = [
  "TEXT",
  "INTEGER",
  "REAL",
  "BLOB",
] as const;

export type SqliteDataType = typeof SQLITE_DATA_TYPES[number];
