import { useEffect, useState, useRef } from "react";
import type { ColumnDef, Table } from "@tanstack/react-table";
import type { TableRow, CellCursor } from "../types";

export function useCellCursor(
  tableData: TableRow[],
  columns: ColumnDef<TableRow>[],
  columnOrder: string[],
  onEnterEditMode?: (rowIndex: number, columnId: string) => void,
  isEditing?: boolean,
  table?: Table<TableRow>
) {
  const [cellCursor, setCellCursor] = useState<CellCursor>({ rowIndex: 0, columnId: "" });
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const ariaLiveRef = useRef<HTMLDivElement>(null);

  // Set default cursor position when data loads
  useEffect(() => {
    if (tableData.length > 0 && columnOrder.length > 0) {
      // Filter out add-column from columnOrder
      const dataColumnIds = columnOrder.filter((id) => id !== "add-column");
      // Try second column, fallback to first column
      const defaultColumnId = dataColumnIds.length > 1 ? dataColumnIds[1] : dataColumnIds[0];
      if (defaultColumnId) {
        setCellCursor({ rowIndex: 0, columnId: defaultColumnId });
      }
    }
  }, [tableData, columnOrder]);

  // Announce cell navigation to screen readers
  const announceCellNavigation = (rowIndex: number, columnId: string) => {
    if (!ariaLiveRef.current || !tableData.length) return;

    const currentRow = tableData[rowIndex];

    if (currentRow && columnId) {
      const cellValue = currentRow[columnId];
      const valueText = cellValue === null || cellValue === undefined ? "NULL" : cellValue;

      ariaLiveRef.current.textContent = `Row ${rowIndex + 1}, Column ${columnId}, Value: ${valueText}`;
    }
  };

  // Handle cell click selection
  const handleCellClick = (rowIndex: number, columnId: string) => {
    setCellCursor({ rowIndex, columnId });
    announceCellNavigation(rowIndex, columnId);
  };

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableData.length || !columnOrder.length) return;

      // Don't handle keyboard navigation while editing
      if (isEditing) return;

      // Get data columns in visual order (excluding add-column)
      const dataColumnIds = columnOrder.filter((id) => id !== "add-column");
      const maxRowIndex = tableData.length - 1;
      const currentColumnIndex = dataColumnIds.indexOf(cellCursor.columnId);

      // If current column not found, reset to first column
      if (currentColumnIndex === -1 && dataColumnIds.length > 0) {
        const firstColumnId = dataColumnIds[0];
        if (firstColumnId) {
          setCellCursor({ rowIndex: cellCursor.rowIndex, columnId: firstColumnId });
        }
        return;
      }

      let moved = false;
      let newCursor = { ...cellCursor };

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          newCursor.rowIndex = Math.max(0, cellCursor.rowIndex - 1);
          moved = newCursor.rowIndex !== cellCursor.rowIndex;
          setCellCursor(newCursor);
          break;

        case "ArrowDown":
          e.preventDefault();
          newCursor.rowIndex = Math.min(maxRowIndex, cellCursor.rowIndex + 1);
          moved = newCursor.rowIndex !== cellCursor.rowIndex;
          setCellCursor(newCursor);
          break;

        case "ArrowLeft":
          e.preventDefault();
          const prevColumnIndex = Math.max(0, currentColumnIndex - 1);
          const prevColumnId = dataColumnIds[prevColumnIndex];
          if (prevColumnId) {
            newCursor.columnId = prevColumnId;
            moved = newCursor.columnId !== cellCursor.columnId;
            setCellCursor(newCursor);
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          const nextColumnIndex = Math.min(dataColumnIds.length - 1, currentColumnIndex + 1);
          const nextColumnId = dataColumnIds[nextColumnIndex];
          if (nextColumnId) {
            newCursor.columnId = nextColumnId;
            moved = newCursor.columnId !== cellCursor.columnId;
            setCellCursor(newCursor);
          }
          break;

        case "Enter":
          e.preventDefault();

          // Get the first data column (excluding add-column)
          const firstDataColumnId = dataColumnIds[0];

          // If we're on the first column (_rowid), toggle checkbox instead of entering edit mode
          if (cellCursor.columnId === firstDataColumnId && table) {
            const row = table.getRowModel().rows[cellCursor.rowIndex];
            if (row) {
              row.toggleSelected();
            }
          } else if (onEnterEditMode && cellCursor.columnId) {
            // For all other columns, enter edit mode
            onEnterEditMode(cellCursor.rowIndex, cellCursor.columnId);
          }
          break;
      }

      if (moved) {
        announceCellNavigation(newCursor.rowIndex, newCursor.columnId);
      }
    };

    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, [tableData, columnOrder, cellCursor, onEnterEditMode, isEditing, table, announceCellNavigation]);

  return {
    cellCursor,
    tableContainerRef,
    ariaLiveRef,
    handleCellClick,
    setCellCursor,
  };
}
