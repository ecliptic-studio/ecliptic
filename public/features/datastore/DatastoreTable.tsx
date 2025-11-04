import { ContextMenu } from "@base-ui-components/react/context-menu";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@public/components/ui/button";
import { globalStore } from "@public/store/store.global";
import { Copy } from "lucide-react";
import { useMemo, useRef, useState, useEffect, useCallback, type MouseEvent } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { AddRowButton } from "./components/AddRowButton";
import { DataTableCell } from "./components/DataTableCell";
import { DraggableTableHeader } from "./components/DraggableTableHeader";
import { NewRowEditor } from "./components/NewRowEditor";
import { useCellCursor } from "./hooks/useCellCursor";
import { useCellEdit } from "./hooks/useCellEdit";
import { useTable } from "./hooks/useTable.tsx";
import type { DatastoreTableProps } from "./types";

function tryParseInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  try {
    const int = parseInt(value);
    return int;
  } catch (error) {
    return defaultValue;
  }
}

export function DatastoreTable({ datastoreId, tableName }: DatastoreTableProps) {
  // Store the context menu trigger element to find the right-clicked cell
  const contextMenuTargetRef = useRef<HTMLElement | null>(null);

  const handleCopyValue = () => {
    const cellElement = contextMenuTargetRef.current;

    if (cellElement) {
      const value = cellElement.dataset.cellValue;
      const isNull = cellElement.dataset.cellIsNull === 'true';
      const valueStr = isNull ? "NULL" : (value || "");

      navigator.clipboard.writeText(valueStr);
      // Uncomment when toast is available
      toast.success("Copied cell value");
    }
  };

  // Look up datastore and table from global store
  const datastore = useStore(globalStore, (s) =>
    s.datastores.find((d) => d.id === datastoreId)
  );

  const tableSchema = useMemo(() => {
    if (!datastore?.schema_json?.tables) return null;
    const table = datastore.schema_json.tables[tableName || ""];
    if (!table) return null;
    return table;
  }, [datastore, tableName]);

  if (!tableSchema) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-lg">Table not found or loading...</p>
      </div>
    );
  }

  const { table, tableStore, addPendingRow, savePendingNewRow, cancelPendingNewRow, addPendingRowEdit, commitPendingEdits, discardPendingEdits, deleteSelectedRows, columns, columnOrder, handleDragEnd, sensors } = useTable(datastoreId, tableName, tableSchema);
  const loading = useStore(tableStore, (s) => s.isLoading);
  const error = useStore(tableStore, (s) => s.error);
  const tableData = useStore(tableStore, (s) => s.tableData);
  const page = useStore(tableStore, (s) => s.page);
  const pageSize = useStore(tableStore, (s) => s.pageSize);
  const hasMore = useStore(tableStore, (s) => s.hasMore);
  const pendingNewRows = useStore(tableStore, (s) => s.pendingNewRows);
  const pendingRowEdits = useStore(tableStore, (s) => s.pendingRowEdits);
  const selectedRowIds = useStore(tableStore, (s) => s.selectedRowIds);

  // Create a ref to store enterEditMode callback
  const enterEditModeRef = useRef<((rowIndex: number, columnId: string) => void) | undefined>(undefined);

  // Cell editing state
  const [editState, setEditState] = useState<{
    rowIndex: number;
    columnId: string;
    value: any;
    originalValue: any;
  } | null>(null);

  // Cell cursor with edit mode support
  const { cellCursor, tableContainerRef, ariaLiveRef, handleCellClick, setCellCursor } = useCellCursor(
    tableData,
    columns,
    columnOrder,
    (rowIndex, columnId) => enterEditModeRef.current?.(rowIndex, columnId),
    editState !== null, // Pass the actual editing state
    table // Pass the table instance for row selection
  );

  // Cell editing
  const {
    editState: editStateFromHook,
    enterEditMode: enterEditModeOriginal,
    cancelEdit,
    saveEdit,
    updateEditValue,
  } = useCellEdit(
    tableData,
    columns,
    (rowId, columnName, value) => {
      // Add the edit to pending state
      addPendingRowEdit(rowId, columnName, value);
    },
    tableContainerRef as React.RefObject<HTMLDivElement>
  );

  // Wrap enterEditMode to start with pending value if it exists
  const enterEditMode = useCallback((rowIndex: number, columnId: string) => {
    // Get the row and column info
    const currentRow = tableData[rowIndex];

    if (currentRow) {
      const rowId = String(currentRow._rowid);

      // Check if there's a pending value
      const rowPendingEdits = pendingRowEdits.get(rowId);
      const hasPendingValue = rowPendingEdits && columnId in rowPendingEdits;

      if (hasPendingValue) {
        // Start edit with the pending value instead of original
        const pendingValue = rowPendingEdits[columnId];
        setEditState({
          rowIndex,
          columnId,
          value: pendingValue,
          originalValue: currentRow[columnId], // Keep original for reference
        });
      } else {
        // No pending value, use original enterEditMode
        enterEditModeOriginal(rowIndex, columnId);
      }
    }
  }, [enterEditModeOriginal, tableData, pendingRowEdits]);

  // Sync edit state
  useEffect(() => {
    setEditState(editStateFromHook);
  }, [editStateFromHook]);

  // Update the ref when enterEditMode changes
  enterEditModeRef.current = enterEditMode;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-lg">Loading table data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <p className="text-lg text-red-600 dark:text-red-400">Error loading table data</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        ref={tableContainerRef}
        tabIndex={0}
        role="application"
        aria-label={`${tableName} data table - Use arrow keys to navigate cells, Enter to edit cell`}
        className="h-full overflow-auto bg-gray-50 dark:bg-gray-900 outline-none relative"
      >
        {/* Screen reader live region for cell navigation announcements */}
        <div
          ref={ariaLiveRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {/* Commit changes button - floating */}
        {pendingRowEdits.size > 0 && (
          <div className="fixed top-20 right-8 z-50">
            <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400 self-center px-2">
                {pendingRowEdits.size} pending row{pendingRowEdits.size !== 1 ? "s" : ""}
              </span>
              <Button variant="outline" size="sm" onClick={discardPendingEdits}>
                Discard
              </Button>
              <Button size="sm" onClick={async () => {
                await commitPendingEdits();
                // Restore focus to table container after commit
                setTimeout(() => {
                  tableContainerRef.current?.focus();
                }, 0);
              }}>
                Commit Changes
              </Button>
            </div>
          </div>
        )}

        {/* Delete selected rows button - floating */}
        {selectedRowIds.size > 0 && (
          <div className="fixed top-36 right-8 z-50">
            <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-red-300 dark:border-red-700">
              <span className="text-sm text-gray-600 dark:text-gray-400 self-center px-2">
                {selectedRowIds.size} row{selectedRowIds.size !== 1 ? "s" : ""} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => {
                // Clear selection
                tableStore.setState({ selectedRowIds: new Set() });
              }}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await deleteSelectedRows();
                  // Restore focus to table container after deletion
                  setTimeout(() => {
                    tableContainerRef.current?.focus();
                  }, 0);
                }}
              >
                Delete ({selectedRowIds.size}) Row{selectedRowIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}


        <div className="relative">
          <ContextMenu.Root>
            <ContextMenu.Trigger
              className="contents"
              onContextMenu={(e: MouseEvent) => {
                // Store which cell was right-clicked
                const target = e.target as HTMLElement;
                const cellElement = target.closest('[data-cell-value]') as HTMLElement;
                contextMenuTargetRef.current = cellElement;
              }}
            >
              <table
                role="grid"
                aria-rowcount={tableData.length || 0}
                aria-colcount={columns.filter((c) => c.id !== "add-column").length}
                style={{ borderCollapse: "separate", borderSpacing: 0 }}
              >
                <thead className="sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} role="row">
                      <SortableContext
                        items={columnOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map((header, index) => {
                          const isFirst = index === 0;
                          const isLast = index === headerGroup.headers.length - 1;
                          const canDrag = !isFirst && !isLast;

                          return (
                            <DraggableTableHeader
                              key={header.id}
                              header={header}
                              canDrag={canDrag}
                              datastoreId={datastoreId}
                              tableName={tableName}
                            />
                          );
                        })}
                      </SortableContext>
                    </tr>
                  ))}
                </thead>
                <tbody>

                  {table.getRowModel().rows.map((row, rowIndex) => {

                    return (
                      <tr
                        key={row.id}
                        role="row"
                        aria-rowindex={rowIndex + 1}
                        data-rowid={row.id}
                      >
                        <SortableContext
                          items={columnOrder}
                          strategy={horizontalListSortingStrategy}
                        >
                          {row.getVisibleCells().map((cell, cellIndex) => {
                            // Skip rendering cells for the "add-column" column
                            if (cell.column.id === "add-column") {
                              return null;
                            }

                            // Get column ID from the cell
                            const columnId = cell.column.id as string;

                            // Check if this is the first column (_rowid)
                            const isFirstColumn = cellIndex === 0;

                            // Determine if this cell is selected by the cursor
                            const isSelected =
                              cellCursor.rowIndex === rowIndex &&
                              cellCursor.columnId === columnId;

                            // Determine if this cell is being edited
                            const isEditing =
                              editState !== null &&
                              editState.rowIndex === rowIndex &&
                              editState.columnId === columnId;

                            // Get column data type from schema
                            const columnInfo = tableSchema?.columns?.[columnId];
                            const columnDataType = (columnInfo?.db_type || "TEXT") as
                              | "TEXT"
                              | "INTEGER"
                              | "REAL"
                              | "BLOB";

                            // Check if this cell has pending changes
                            const rowId = String(row.original._rowid);
                            const rowPendingEdits = pendingRowEdits.get(parseInt(rowId) as any);
                            const hasPendingChange = !!(rowPendingEdits && columnId in rowPendingEdits);
                            const pendingValue = hasPendingChange ? rowPendingEdits[columnId] : undefined;

                            return (
                              <DataTableCell
                                key={cell.id}
                                cell={cell}
                                isSelected={isSelected}
                                isEditing={isEditing}
                                editValue={editState?.value}
                                columnDataType={columnDataType}
                                pendingValue={pendingValue}
                                hasPendingChange={hasPendingChange}
                                onCellClick={() => handleCellClick(rowIndex, columnId)}
                                onDoubleClick={isFirstColumn ? undefined : () => enterEditMode(rowIndex, columnId)}
                                onEditValueChange={updateEditValue}
                                onSaveEdit={saveEdit}
                                onCancelEdit={cancelEdit}
                              />
                            );
                          })}
                        </SortableContext>
                      </tr>
                    );
                  })}

                </tbody>

                <tfoot>
                  {pendingNewRows.map((pendingRow) => (
                    <NewRowEditor
                      key={pendingRow._tempId! as unknown as string}
                      columns={columns}
                      tableSchema={tableSchema}
                      initialData={pendingRow}
                      onSave={savePendingNewRow}
                      onCancel={cancelPendingNewRow}
                    />
                  ))}

                  <AddRowButton onAddRow={addPendingRow} />

                  <tr>
                    <td
                      colSpan={columns.length}
                      className="border-t border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-6 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Rows per page:
                          </span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              tableStore.setState({ pageSize: Number(e.target.value) });
                            }}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Page {page}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => tableStore.setState({ page: 1 })}
                              disabled={page === 1}
                            >
                              First
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => tableStore.setState({ page: tableStore.getState().page - 1 })}
                              disabled={page === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => tableStore.setState({ page: tableStore.getState().page + 1 })}
                              disabled={!hasMore}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner sideOffset={5}>
                <ContextMenu.Popup className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[160px]">
                  <ContextMenu.Item
                    onClick={handleCopyValue}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none"
                  >
                    <Copy className="size-4" />
                    Copy value
                  </ContextMenu.Item>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </div>
      </div>
    </DndContext>
  );
}
