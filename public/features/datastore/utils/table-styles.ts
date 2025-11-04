import type { Column } from "@tanstack/react-table";
import type { CSSProperties } from "react";
import type { TableRow } from "../types";

export function getCommonPinningStyles(column: Column<TableRow>): CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");

  return {
    boxShadow: isLastLeftPinnedColumn
      ? "-4px 0 4px -4px gray inset"
      : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    width: `${column.getSize()}px`,
    minWidth: `${column.getSize()}px`,
    maxWidth: `${column.getSize()}px`,
    zIndex: isPinned ? 2 : 0,
  };
}
