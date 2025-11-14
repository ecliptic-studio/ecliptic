import apis from "@public/api-calls";
import { createStore, type StoreApi } from "zustand";
import type { TableRow } from "../types";

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
    apis["/api/v1/datastore/:id/table/:tableName"].GET({id: datastoreId, tableName}, {limit: pageSize, offset: (page - 1) * pageSize} )
      .then(([data, error]) => {
        if(error) {
          store.setState({ error });
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

  return store;
}
