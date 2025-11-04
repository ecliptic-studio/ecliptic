import { useState, useCallback } from "react";
import type { TableRow, CellEditState } from "../types";
import type { ColumnDef } from "@tanstack/react-table";

export function useCellEdit(
  tableData: TableRow[],
  columns: ColumnDef<TableRow>[],
  onCellUpdate: (rowId: string, columnName: string, value: any) => void,
  tableContainerRef?: React.RefObject<HTMLDivElement>
) {
  const [editState, setEditState] = useState<CellEditState>(null);

  // Enter edit mode
  const enterEditMode = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!tableData.length || !columns.length) return;

      const currentRow = tableData[rowIndex];
      const currentColumn = columns.find((c) => c.id === columnId);

      if (currentRow && currentColumn) {
        const cellValue = currentRow[columnId];

        setEditState({
          rowIndex,
          columnId,
          value: cellValue,
          originalValue: cellValue,
        });
      }
    },
    [tableData, columns]
  );

  // Cancel edit mode (revert to original value)
  const cancelEdit = useCallback(() => {
    setEditState(null);
    // Restore focus to table container for keyboard navigation
    setTimeout(() => {
      tableContainerRef?.current?.focus();
    }, 0);
  }, [tableContainerRef]);

  // Save edit (call the update callback)
  const saveEdit = useCallback(() => {
    if (!editState) return;

    const currentRow = tableData[editState.rowIndex];
    const currentColumn = columns.find((c) => c.id === editState.columnId);

    if (!currentRow || !currentColumn) {
      setEditState(null);
      return;
    }

    const columnId = editState.columnId;
    const rowId = currentRow._rowid;

    // Only update if value actually changed
    if (editState.value !== editState.originalValue) {
      onCellUpdate(rowId, columnId, editState.value);
    }

    setEditState(null);

    // Restore focus to table container for keyboard navigation
    setTimeout(() => {
      tableContainerRef?.current?.focus();
    }, 0);
  }, [editState, tableData, columns, onCellUpdate, tableContainerRef]);

  // Update edit value (during typing)
  const updateEditValue = useCallback((value: any) => {
    setEditState((prev) => {
      if (!prev) return null;
      return { ...prev, value };
    });
  }, []);

  return {
    editState,
    enterEditMode,
    cancelEdit,
    saveEdit,
    updateEditValue,
  };
}
