import { useEffect, useState } from "react";
import rpcClient from "@public/rpc-client";
import type { TableRow } from "../types";
import { createStore, useStore, type StoreApi } from "zustand";

export type TTableDataStore = {
  tableData: TableRow[]
  isLoading: boolean
  error: string | null
  page: number
  pageSize: number
  hasMore: boolean,
  pendingNewRows: Record<string, TableRow>[]
  // Map of row ID to column changes: { rowId: { columnName: newValue } }
  pendingRowEdits: Map<string, Record<string, any>>
  // Set of selected row IDs (for future bulk operations like deletion)
  selectedRowIds: Set<string>
}

const cachedStores = new Map<string, StoreApi<TTableDataStore>>();

/**
 * Not in use yet
 */
export function getTableStore(datastoreId: string, tableName: string, options?: { page: number, pageSize: number }) {
  if (cachedStores.has(datastoreId + tableName)) {
    return cachedStores.get(datastoreId + tableName)!;
  }

  const store = createStore<TTableDataStore>((set, get) => ({
    tableData: [],
    isLoading: true,
    error: null,
    page: options?.page || 1,
    pageSize: options?.pageSize || 50,
    hasMore: false,
    pendingNewRows: [],
    pendingRowEdits: new Map(),
    selectedRowIds: new Set()
  }))

  // @ts-ignore
  window.tableStore = store;
  cachedStores.set(datastoreId + tableName, store);
  store.subscribe((state, prevState) => {
    if(state.pageSize !== prevState?.pageSize) {
      fetchTableData()
    }
    if(state.page !== prevState?.page) {
      fetchTableData()
    }
  })
  function fetchTableData() {
    const { page, pageSize } = store.getState()
    rpcClient.api.v1.datastore({ id: datastoreId })
      .table({ tableName })
      .get({query: {limit: pageSize, offset: (page - 1) * pageSize}})
      .then(({ data, error }) => {
        if(error) {
          store.setState({ error: error.value?.message || "Failed to fetch table data" });
          return
        }
        if(data) {
          store.setState({ tableData: data.data, hasMore: data.pagination.hasMore });
        }
        store.setState({ isLoading: false });
      })
  }
  setTimeout(() => {
    fetchTableData()
  }, 0);



  // const [tableData, setTableData] = useState<TableRow[]>([]);
  // const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   const fetchTableData = async () => {
  //     if (!datastoreId || !tableName) return;

  //     setIsLoading(true);
  //     setError(null);

  //     try {
  //       // PostgREST syntax: use 'limit' instead of 'pageSize'
  //       // Note: Not specifying 'select' will return all columns including ROWID
  //       const { data, error: apiError } = await rpcClient.api.v1.datastore({ id: datastoreId }).table({ tableName }).get({
  //         query: {
  //           limit: 50,
  //           offset: 0
  //         }
  //       });

  //       if (apiError) {
  //         setError(apiError.value?.message || "Failed to fetch table data");
  //         setTableData([]);
  //         return;
  //       }

  //       if (data) {
  //         setTableData(data.data as TableRow[] || []);
  //       }
  //     } catch (err) {
  //       setError("An unexpected error occurred");
  //       setTableData([]);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   fetchTableData();
  // }, [datastoreId, tableName]);

  return store;
}
