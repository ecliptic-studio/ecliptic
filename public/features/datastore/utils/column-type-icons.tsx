import { Type, Hash, Calculator, Binary } from "lucide-react";
import type { SqliteDataType } from "../constants";

/**
 * Maps SQLite data types to their corresponding icon components
 */
export function getDataTypeIcon(dataType: string) {
  const normalizedType = dataType.toUpperCase();

  switch (normalizedType) {
    case "TEXT":
      return Type;
    case "INTEGER":
      return Hash;
    case "REAL":
      return Calculator;
    case "BLOB":
      return Binary;
    default:
      return Type; // Default to text icon
  }
}

/**
 * Gets a friendly label for a data type (for tooltips/aria-labels)
 */
export function getDataTypeLabel(dataType: string): string {
  const normalizedType = dataType.toUpperCase();

  switch (normalizedType) {
    case "TEXT":
      return "Text";
    case "INTEGER":
      return "Integer";
    case "REAL":
      return "Real number";
    case "BLOB":
      return "Binary data";
    default:
      return "Unknown type";
  }
}
