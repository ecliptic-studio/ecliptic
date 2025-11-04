import rpcClient from "@public/rpc-client";
import { getCoreRowModel, useReactTable, type RowSelectionState } from "@tanstack/react-table";
import { enableMapSet, produce } from "immer";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "zustand";
import { getTableStore, type TTableDataStore } from "../store/store.table";
import { useColumnManagement, type TableSchema } from "./useColumnManagement";
import { useEffect } from "react";

// Enable Immer's MapSet plugin for working with Map and Set
enableMapSet();

function tryParseInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  try {
    const int = parseInt(value);
    return int;
  } catch (error) {
    return defaultValue;
  }
}

export function useTable(datastoreId: string, tableName: string, tableSchema: TableSchema) {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = tryParseInt(searchParams.get('page'), 1)
  const pageSize = tryParseInt(searchParams.get('pageSize'), 50)

  const tableStore = getTableStore(datastoreId, tableName, { page, pageSize })
  const { columns, columnOrder, setColumnOrder, sensors, handleDragEnd } = useColumnManagement(tableSchema, datastoreId, tableName);

  // Get selected row IDs from store and convert to TanStack Table's format
  const selectedRowIds = useStore(tableStore, (s) => s.selectedRowIds);
  const rowSelection: RowSelectionState = {};
  selectedRowIds.forEach(rowId => {
    rowSelection[rowId] = true;
  });

  const table = useReactTable({
    data: useStore(tableStore, (s) => s.tableData),
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableRowSelection: true,
    state: {
      columnOrder,
      rowSelection,
      pagination: {
        pageIndex: tableStore.getState().page,
        pageSize: tableStore.getState().pageSize,
      }
    },
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: (updaterOrValue) => {
      // Sync TanStack Table's rowSelection with Zustand store's selectedRowIds
      const newRowSelection = typeof updaterOrValue === 'function'
        ? updaterOrValue(rowSelection)
        : updaterOrValue;

      // Convert RowSelectionState object to Set of row IDs
      const newSelectedRowIds = new Set(
        Object.keys(newRowSelection).filter(key => newRowSelection[key])
      );

      tableStore.setState({ selectedRowIds: newSelectedRowIds });
    },
    initialState: {
      columnPinning: {
        left: columns.length > 0 ? [columns[0]?.id as string] : [],
      },
    },
    getRowId: (row, index) => row._rowid != null ? String(row._rowid) : `row-${index}`,
  });

  const addPendingRow = () => {
    const pendingRow:any = {_tempId: crypto.randomUUID()}
    Object.keys(tableSchema.columns ?? {}).forEach((field:any) => {
      pendingRow[field] = null
    })
    tableStore.setState({ pendingNewRows: [...tableStore.getState().pendingNewRows, pendingRow] })
  }

  const savePendingNewRow = (row: Record<string, any>) => {
    console.log('savePendingRow', row)
    const { _tempId, ...rest } = row

    // Parse values according to their data types
    const parsedRow: Record<string, any> = {}
    Object.keys(rest).forEach((key) => {
      const value = rest[key]
      const columnInfo = tableSchema.columns?.[key]
      const dbType = columnInfo?.db_type?.toUpperCase() || "TEXT"

      // Handle null/empty values
      if (value === null || value === "") {
        parsedRow[key] = null
        return
      }

      // Parse based on data type
      if (dbType === "INTEGER") {
        parsedRow[key] = parseInt(value, 10)
      } else if (dbType === "REAL") {
        parsedRow[key] = parseFloat(value)
      } else {
        // TEXT and BLOB remain as strings
        parsedRow[key] = value
      }
    })

    rpcClient.api.v1.datastore({ id: datastoreId }).table({ tableName }).post(parsedRow)
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.value?.message || 'Failed to save pending row')
        }
        if (data) {
          toast.success('Pending row saved')
          // Remove from pending rows
          tableStore.setState({
            pendingNewRows: tableStore.getState().pendingNewRows.filter((r) => r._tempId !== _tempId)
          })
          // Add to table data - extract first row from the result
          if (data.rows && data.rows.length > 0) {
            const currentData = tableStore.getState().tableData || []
            const newRow = data.rows[0] as any // The row includes _rowid from the backend
            tableStore.setState({
              tableData: [...currentData, newRow]
            })
          }
        }
      })

  }

  const cancelPendingNewRow = async (tempId: string) => {
    tableStore.setState({ pendingNewRows: tableStore.getState().pendingNewRows.filter((row) => (row._tempId ?? '') !== tempId) })
  }

  const addPendingRowEdit = (rowId: string, columnName: string, newValue: any) => {
    tableStore.setState(state => {
      const newPendingEdits = new Map(state.pendingRowEdits)
      const existingRowEdits = newPendingEdits.get(rowId) || {}

      // Add or update the column change for this row
      newPendingEdits.set(rowId, {
        ...existingRowEdits,
        [columnName]: newValue
      })

      return {
        ...state,
        pendingRowEdits: newPendingEdits
      }
    })
  }

  const commitPendingEdits = async () => {
    const { pendingRowEdits } = tableStore.getState()

    if (pendingRowEdits.size === 0) return

    // Group changes by row and send one request per row
    const promises = Array.from(pendingRowEdits.entries()).map(async ([rowId, changes]) => {
      try {
        // PostgREST syntax: query params contain the WHERE filter, body contains the updates
        const { data, error } = await rpcClient.api.v1
          .datastore({ id: datastoreId })
          .table({ tableName })
          .patch(changes, {
            query: {
              _rowid_: `eq.${rowId}` // PostgREST WHERE filter must be _rowid_
            }
          })

        if (error) {
          toast.error(`Failed to update row ${rowId}: ${error.value?.message}`)
          return { success: false, rowId }
        }

        if (data) {
          toast.success(`Row ${rowId} updated successfully`)
          return { success: true, rowId, data }
        }
      } catch (err) {
        toast.error(`Error updating row ${rowId}`)
        return { success: false, rowId }
      }
    })

    const results = await Promise.all(promises)

    // Clear pending edits and update table data
    const successfulResults = results.filter(r => r?.success)
    if (successfulResults.length > 0) {
      tableStore.setState(
        produce((state: TTableDataStore) => {
          // Clear pending edits for successful rows
          successfulResults.forEach(result => {
            if (result?.rowId) {
              state.pendingRowEdits.delete(parseInt(result.rowId) as any)
            }
          })

          // Update table data with the new values from server (in-place)
          state.tableData.forEach((row, index) => {
            const rowIdStr = String(row._rowid)
            const result = successfulResults.find(r => String(r!.rowId) === rowIdStr)

            if (result && result.data && result.data.rows && result.data.rows.length > 0) {
              // Replace the row data in-place
              state.tableData[index] = result.data.rows[0] as any
            }
          })
        })
      )
    }
  }

  const discardPendingEdits = () => {
    tableStore.setState(state => ({
      ...state,
      pendingRowEdits: new Map()
    }))
    toast.info('All pending changes discarded')
  }

  const deleteSelectedRows = async () => {
    const { selectedRowIds } = tableStore.getState()

    if (selectedRowIds.size === 0) {
      toast.error('No rows selected')
      return
    }

    // Convert Set<string> to number[] for API
    const rowIdsToDelete = Array.from(selectedRowIds).map(id => Number(id))

    // Send single DELETE request with all rowids
    try {
      const { error } = await rpcClient.api.v1
        .datastore({ id: datastoreId })
        .table({ tableName })
        .delete({
          rowids: rowIdsToDelete
        })

      if (error) {
        toast.error(`Failed to delete rows: ${error.value?.message}`)
        return
      }

      // Remove deleted rows from table data
      tableStore.setState(
        produce((state: TTableDataStore) => {
          const deletedRowIds = new Set(selectedRowIds)
          state.tableData = state.tableData.filter(row => !deletedRowIds.has(String(row._rowid)))

          // Clear selection
          state.selectedRowIds.clear()
        })
      )

      toast.success(`Successfully deleted ${rowIdsToDelete.length} row${rowIdsToDelete.length !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(`Error deleting rows`)
    }
  }

  return {
    tableStore,
    table,
    columns,
    columnOrder,
    handleDragEnd,
    sensors,
    addPendingRow,
    savePendingNewRow,
    cancelPendingNewRow,
    addPendingRowEdit,
    commitPendingEdits,
    discardPendingEdits,
    deleteSelectedRows,
  }
}