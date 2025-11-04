# Datastore Feature

The Datastore feature provides a comprehensive, interactive table editor for viewing and editing SQLite database tables. It combines TanStack Table, DnD Kit, and Zustand to create a spreadsheet-like experience with Excel-style keyboard navigation, inline editing, and drag-and-drop column reordering.

## Feature Location

```
@public/features/datastore/
```

## Overview

The Datastore feature is a complex, multi-component system that provides:

- **Interactive Data Table**: View and edit database rows with a familiar spreadsheet interface
- **Keyboard Navigation**: Excel-like arrow key navigation with Enter-to-edit functionality
- **Inline Cell Editing**: Double-click or Enter to edit cells with type-aware inputs
- **Pending Changes Management**: Track, preview, and batch-commit edits before saving
- **Column Management**: Drag-and-drop reordering, resizing, and context menus
- **Type Safety**: SQLite data type awareness (TEXT, INTEGER, REAL, BLOB)
- **Accessibility**: Full keyboard support, ARIA announcements, and semantic HTML

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DatastoreTable.tsx                        │
│                  (Main Component)                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  DnD Context (Column Reordering)                    │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  HTML Table                                   │  │    │
│  │  │  ├─ DraggableTableHeader (thead)             │  │    │
│  │  │  ├─ DataTableCell (tbody)                    │  │    │
│  │  │  │   └─ EditableCell (when editing)          │  │    │
│  │  │  └─ NewRowEditor + AddRowButton (tfoot)      │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     useTable Hook                            │
│                (Orchestration Layer)                         │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ TanStack Table  │  │ Zustand Store  │  │ RPC Client   │ │
│  │ (Table Logic)   │  │ (State Mgmt)   │  │ (API Calls)  │ │
│  └─────────────────┘  └────────────────┘  └──────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useColumnManagement (Column Defs + DnD)             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supporting Hooks                            │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │ useCellCursor    │  │ useCellEdit                   │    │
│  │ (Navigation)     │  │ (Edit State)                  │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
public/features/datastore/
├── components/
│   ├── AddColumnDropdown.tsx         # Dropdown for adding new columns
│   ├── AddRowButton.tsx              # Button to add new rows to the table
│   ├── DataTableCell.tsx             # Cell component with selection, editing, pending state
│   ├── DraggableTableHeader.tsx      # Header with drag, resize, context menu
│   ├── EditableCell.tsx              # Input component for cell editing
│   └── NewRowEditor.tsx              # Row editor for creating new rows
├── hooks/
│   ├── useCellCursor.ts              # Manages cursor position and keyboard navigation
│   ├── useCellEdit.ts                # Handles cell editing state
│   ├── useColumnManagement.tsx       # Column definitions, DnD, column ordering
│   └── useTable.tsx                  # Main hook coordinating table, store, data fetching
├── store/
│   └── store.table.ts                # Zustand store for table state
├── utils/
│   ├── column-type-icons.tsx         # Icons and labels for SQLite data types
│   └── table-styles.ts               # Pinning styles for columns
├── DatastoreTable.tsx                # Main table component
├── types.ts                          # TypeScript type definitions
├── constants.ts                      # SQLite data types constants
└── index.ts                          # Public API exports
```

## Core Components

### DatastoreTable.tsx

**Purpose**: The main table rendering component that orchestrates all datastore functionality.

**Key Responsibilities**:
- Renders HTML table with semantic structure (thead, tbody, tfoot)
- Integrates DnD context for column drag-and-drop
- Manages cell editing UI and state
- Displays pending edits indicator and commit button
- Handles pagination controls
- Provides context menu (copy cell value)
- Manages focus restoration after edits
- Accessibility: ARIA live region for screen reader announcements

**Props**:
```typescript
interface DatastoreTableProps {
  datastoreId: string;  // Unique datastore identifier
  tableName: string;    // Table to display/edit
}
```

**State Integration**:
- Uses `useTable` hook for all business logic
- Uses `useCellCursor` for keyboard navigation
- Uses `useCellEdit` for cell editing
- Subscribes to Zustand store for table data, loading, errors

**File**: `@public/features/datastore/DatastoreTable.tsx:1`

### Cell Components

#### DataTableCell.tsx

**Purpose**: Renders individual table cells (`<td>` elements) with rich interaction capabilities.

**Features**:
- Selection border when cell is focused
- Pending change indicator (yellow triangle icon)
- Click/double-click handlers for editing
- NULL value styling (muted text)
- Drag styles from dnd-kit
- Context menu support (stores value in data attributes)

**Props**:
```typescript
{
  cell: Cell<TableRow, unknown>;        // TanStack Table cell
  isSelected: boolean;                  // Cursor position match
  isPending: boolean;                   // Has uncommitted edit
  onCellClick: (rowIndex, columnIndex) => void;
  onCellDoubleClick: (rowIndex, columnIndex) => void;
}
```

**File**: `@public/features/datastore/components/DataTableCell.tsx:1`

#### EditableCell.tsx

**Purpose**: Input component for inline cell editing.

**Features**:
- Auto-focuses and selects text on mount
- Type-aware input (number for INTEGER/REAL, text for TEXT/BLOB)
- Keyboard handlers:
  - Enter: Save changes
  - Escape: Cancel editing
- Real-time value change callbacks
- Type coercion: empty string → NULL

**Props**:
```typescript
{
  initialValue: any;
  columnType: SQLiteDataType;
  onSave: (newValue: any) => void;
  onCancel: () => void;
  onValueChange?: (value: any) => void;
}
```

**File**: `@public/features/datastore/components/EditableCell.tsx:1`

### Header Components

#### DraggableTableHeader.tsx

**Purpose**: Renders column headers with drag-and-drop, resizing, and context menu.

**Features**:
- Drag handle for column reordering
- Data type icon with tooltip (SQLite type)
- Context menu:
  - Copy column name
  - Delete column
- Resize handle (double-click to reset)
- Column pinning styles (left/right/none)

**Props**:
```typescript
{
  header: Header<TableRow, unknown>;  // TanStack Table header
}
```

**Integration**: Uses DnD Kit's `useSortable` hook for drag operations.

**File**: `@public/features/datastore/components/DraggableTableHeader.tsx:1`

### Row Management Components

#### AddRowButton.tsx

**Purpose**: Simple button in table footer to add new rows.

**Behavior**: Triggers `addPendingRow()` from `useTable` hook.

**File**: `@public/features/datastore/components/AddRowButton.tsx:1`

#### NewRowEditor.tsx

**Purpose**: Full row editor shown in tfoot for creating new rows.

**Features**:
- Input fields for each column (type-aware)
- Save button: Validates and commits new row
- Cancel button: Discards pending row
- Local state for form data before commit

**Props**:
```typescript
{
  columns: ColumnDef<TableRow>[];
  pendingRow: TableRow;
  onSave: (rowId: string, data: TableRow) => Promise<void>;
  onCancel: (rowId: string) => void;
}
```

**File**: `@public/features/datastore/components/NewRowEditor.tsx:1`

#### AddColumnDropdown.tsx

**Purpose**: Dropdown for selecting SQLite data type when adding columns.

**Features**:
- Lists all SQLite data types (TEXT, INTEGER, REAL, BLOB)
- Icons for each type
- Opens datastore-dialogs for column creation

**File**: `@public/features/datastore/components/AddColumnDropdown.tsx:1`

## Hooks

### useTable.tsx (Main Orchestration Hook)

**Purpose**: The central hook that coordinates all table functionality, integrating TanStack Table, Zustand store, and API client.

**Responsibilities**:
1. **Store Management**: Creates/retrieves cached Zustand store via `getTableStore()`
2. **TanStack Table Setup**: Initializes React Table with column definitions and data
3. **Pending Row Operations**:
   - `addPendingRow()`: Creates temporary row with UUID
   - `savePendingNewRow()`: Validates types and POSTs new row to API
   - `cancelPendingNewRow()`: Removes pending row without saving
4. **Pending Edit Operations**:
   - `addPendingRowEdit()`: Tracks cell edits in Map
   - `commitPendingEdits()`: Batches PATCH requests, updates store via Immer
   - `discardPendingEdits()`: Clears all pending edits
5. **Column Management**: Integrates `useColumnManagement()` hook
6. **Pagination**: Parses URL search params for page state

**Returns**:
```typescript
{
  table: Table<TableRow>;                      // TanStack Table instance
  tableData: TableRow[];                       // Current page data
  isLoading: boolean;                          // Loading state
  error: string | null;                        // Error message
  page: number;                                // Current page (1-indexed)
  pageSize: number;                            // Items per page
  hasMore: boolean;                            // More pages available
  pendingNewRows: Record<string, TableRow>[];  // Rows being created
  pendingRowEdits: Map<string, Record<string, any>>;  // Unsaved edits
  addPendingRow: () => void;
  savePendingNewRow: (rowId: string, data: TableRow) => Promise<void>;
  cancelPendingNewRow: (rowId: string) => void;
  addPendingRowEdit: (rowId: string, columnName: string, newValue: any) => void;
  commitPendingEdits: () => Promise<void>;
  discardPendingEdits: () => void;
  // ... and more
}
```

**File**: `@public/features/datastore/hooks/useTable.tsx:1`

**Key Implementation Details**:
- Uses Immer's `produce()` with `enableMapSet()` for complex state updates
- Batches API requests for efficiency (multiple PATCHes in `commitPendingEdits`)
- Type coercion for SQLite types (e.g., string to number for INTEGER)
- Error handling with toast notifications

### useColumnManagement.tsx

**Purpose**: Manages column definitions and drag-and-drop reordering.

**Responsibilities**:
1. **Column Definition Generation**: Creates TanStack Table `ColumnDef[]` from table schema
2. **Special Columns**:
   - First column: Checkbox for row selection
   - Last column: Add-column dropdown button
3. **DnD Setup**:
   - Configures DnD Kit sensors (Mouse, Touch, Keyboard)
   - Handles column reordering with constraints (first/last columns locked)
4. **Dialog Integration**: Opens datastore-dialogs for adding columns

**Returns**:
```typescript
{
  columns: ColumnDef<TableRow>[];       // Column definitions
  columnOrder: string[];                // Current column order
  setColumnOrder: (order: string[]) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  sensors: SensorDescriptor<any>[];     // DnD Kit sensors
}
```

**File**: `@public/features/datastore/hooks/useColumnManagement.tsx:1`

**Column Cell Rendering**:
Each data column renders a `DataTableCell` component with:
- Selection state from `useCellCursor`
- Pending state from `pendingRowEdits` Map
- Click handlers for navigation and editing

### useCellCursor.ts

**Purpose**: Manages cursor position and Excel-like keyboard navigation.

**Responsibilities**:
1. **Cursor State**: Tracks current cell (rowIndex, columnIndex)
2. **Keyboard Navigation**:
   - Arrow keys: Move cursor (up/down/left/right)
   - Enter: Trigger edit mode
   - Boundary checks to prevent overflow
3. **Accessibility**:
   - Announces cell navigation to ARIA live region
   - Includes row/column labels in announcements
   - Announces NULL values

**Returns**:
```typescript
{
  cellCursor: CellCursor | null;        // { rowIndex, columnIndex }
  setCellCursor: (cursor: CellCursor | null) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  announceCell: (rowIndex: number, columnIndex: number, value: any) => void;
}
```

**File**: `@public/features/datastore/hooks/useCellCursor.ts:1`

**Integration**: DatastoreTable uses this hook to:
- Highlight selected cell
- Handle keyboard events
- Pass `onCellClick` to update cursor

### useCellEdit.ts

**Purpose**: Manages individual cell editing state.

**Responsibilities**:
1. **Edit State**: Tracks currently editing cell (rowIndex, columnIndex, value, originalValue)
2. **Keyboard Bindings**:
   - Enter: Save edit
   - Escape: Cancel edit
3. **Lifecycle**:
   - `enterEditMode()`: Starts editing
   - `saveEdit()`: Calls callback with new value, exits edit mode
   - `cancelEdit()`: Restores original value, exits edit mode
4. **Focus Management**: Restores focus to table after edit complete

**Returns**:
```typescript
{
  editState: CellEditState | null;      // Edit state or null
  enterEditMode: (rowIndex, columnIndex, currentValue, columnType) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  updateEditValue: (value: any) => void;
  isEditing: boolean;
}
```

**File**: `@public/features/datastore/hooks/useCellEdit.ts:1`

**Integration**: DatastoreTable:
- Passes `enterEditMode` to cell click/keyboard handlers
- Renders `EditableCell` when `editState` is not null
- Calls `onCellUpdate` callback which triggers `addPendingRowEdit()`

## Store Architecture

### store.table.ts (Zustand Store)

**Purpose**: Centralized state management for table data, loading, errors, and pending operations.

**Store Type**:
```typescript
interface TTableDataStore {
  // Data
  tableData: TableRow[];                      // Array of rows with _rowid field

  // Loading & Error
  isLoading: boolean;
  error: string | null;

  // Pagination
  page: number;                               // Current page (1-indexed)
  pageSize: number;                           // Items per page
  hasMore: boolean;                           // If more pages available

  // Pending Operations
  pendingNewRows: Record<string, TableRow>[]; // Rows being created (keyed by temp UUID)
  pendingRowEdits: Map<string, Record<string, any>>;  // Unsaved edits (rowid → column → value)

  // Actions
  setTableData: (data: TableRow[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setHasMore: (hasMore: boolean) => void;
  addPendingNewRow: (row: Record<string, TableRow>) => void;
  removePendingNewRow: (rowId: string) => void;
  addPendingRowEdit: (rowId: string, columnName: string, value: any) => void;
  commitPendingEdits: (rowId: string) => void;
  discardAllPendingEdits: () => void;
  updateTableRow: (rowId: string, updates: Partial<TableRow>) => void;
}
```

**File**: `@public/features/datastore/store/store.table.ts:1`

**Key Features**:

#### Cached Store Instances
```typescript
const cachedStores = new Map<string, ReturnType<typeof createTableStore>>();

export function getTableStore(datastoreId: string, tableName: string) {
  const key = `${datastoreId}:${tableName}`;
  if (!cachedStores.has(key)) {
    cachedStores.set(key, createTableStore(datastoreId, tableName));
  }
  return cachedStores.get(key)!;
}
```

This ensures one store per table, preventing state conflicts when multiple tables are open.

#### Auto-Fetching on Pagination Changes
The store subscribes to itself and refetches data when page/pageSize changes:

```typescript
store.subscribe(
  (state) => [state.page, state.pageSize],
  async ([page, pageSize]) => {
    await fetchData(page, pageSize);
  }
);
```

#### Pending Edits Map
Uses `Map<string, Record<string, any>>` for efficient tracking of uncommitted edits:
- Key: `rowid` (unique row identifier)
- Value: Object mapping column names to new values

This allows:
- Fast lookup: "Does this cell have a pending edit?"
- Batch commits: Iterate Map entries to send PATCH requests
- Easy discard: Clear the Map

**Note**: The comment in the file indicates this store may be deprecated in favor of direct usage within hooks.

## Types and Constants

### types.ts

**Key Types**:
```typescript
/**
 * Table row with required _rowid field
 */
export type TableRow = Record<string, any> & {
  _rowid: string;
};

/**
 * Column schema from database
 */
export interface ColumnSchema {
  name: string;
  order: number;
  db_type: SQLiteDataType;
}

/**
 * Props for DatastoreTable component
 */
export interface DatastoreTableProps {
  datastoreId: string;
  tableName: string;
}

/**
 * Cell cursor position
 */
export interface CellCursor {
  rowIndex: number;
  columnIndex: number;
}

/**
 * Cell editing state
 */
export type CellEditState = {
  rowIndex: number;
  columnIndex: number;
  value: any;
  originalValue: any;
  columnType: SQLiteDataType;
} | null;

/**
 * Pending change metadata
 */
export interface PendingChange {
  rowId: string;
  columnName: string;
  oldValue: any;
  newValue: any;
}

export type PendingChanges = PendingChange[];
```

**File**: `@public/features/datastore/types.ts:1`

### constants.ts

**SQLite Data Types**:
```typescript
export const SQLITE_DATA_TYPES = [
  "TEXT",
  "INTEGER",
  "REAL",
  "BLOB",
] as const;

export type SQLiteDataType = typeof SQLITE_DATA_TYPES[number];
```

**File**: `@public/features/datastore/constants.ts:1`

## Data Flow Diagrams

### 1. Data Fetching Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. useTable creates/retrieves cached Zustand store        │
│    getTableStore(datastoreId, tableName)                   │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 2. Store subscription watches page/pageSize changes       │
│    store.subscribe((state) => [state.page, state.pageSize])│
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Auto-fetch triggered                                    │
│    rpcClient.api.v1.datastore[datastoreId].table[name].get │
│    - Query params: page, pageSize                          │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 4. Update store state                                      │
│    - setTableData(rows)                                    │
│    - setIsLoading(false)                                   │
│    - setHasMore(hasMore)                                   │
│    - setError(null) or setError(message)                   │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 5. DatastoreTable subscribes to store                     │
│    const tableData = useStore(store, (s) => s.tableData)  │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 6. React re-render with new table data                    │
└────────────────────────────────────────────────────────────┘
```

### 2. Cell Editing Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. User interaction                                        │
│    - Double-click cell                                     │
│    - OR: Select cell + press Enter                         │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 2. useCellEdit.enterEditMode()                             │
│    - Sets editState: { rowIndex, columnIndex, value, ... } │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. DatastoreTable renders EditableCell                    │
│    - Auto-focuses input                                    │
│    - Type-aware: number/text input based on columnType    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 4. User types, onValueChange updates editState.value      │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 5. User presses Enter                                      │
│    → useCellEdit.saveEdit()                                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 6. onCellUpdate callback → DatastoreTable                 │
│    → addPendingRowEdit(rowId, columnName, newValue)       │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 7. Update store.pendingRowEdits Map                       │
│    Map.set(rowId, { ...existing, [columnName]: newValue }) │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 8. DataTableCell shows pending indicator                  │
│    - Yellow triangle icon                                  │
│    - "Commit Changes" button appears                       │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 9. User clicks "Commit Changes"                            │
│    → useTable.commitPendingEdits()                         │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 10. Batch PATCH requests                                   │
│     For each rowId in pendingRowEdits Map:                 │
│       PATCH /api/v1/datastore/:id/table/:name/rows/:rowid  │
│       Body: { [columnName]: newValue, ... }                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 11. On success, update store via Immer                    │
│     produce(draft => {                                     │
│       - Clear pendingRowEdits Map                          │
│       - Update tableData with new values                   │
│     })                                                      │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 12. Re-render table with committed data                   │
│     - Pending indicators removed                           │
└────────────────────────────────────────────────────────────┘
```

### 3. New Row Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. User clicks "Add Row" button                           │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 2. addPendingRow()                                         │
│    - Generate temp UUID                                    │
│    - Create row: { _rowid: uuid, ...emptyValues }          │
│    - Add to store.pendingNewRows array                     │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. NewRowEditor component renders in tfoot                │
│    - Input fields for each column                          │
│    - Local state for form data                             │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 4. User fills in values                                    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 5. User clicks Save                                        │
│    → savePendingNewRow(rowId, data)                        │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 6. Type parsing and validation                            │
│    - Convert strings to numbers for INTEGER/REAL          │
│    - Empty strings → NULL                                  │
│    - Remove _rowid from payload                            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 7. POST request                                            │
│    POST /api/v1/datastore/:id/table/:name/rows             │
│    Body: { [columnName]: value, ... }                      │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 8. On success                                              │
│    - Remove from store.pendingNewRows                      │
│    - Add to store.tableData (with real rowid)              │
│    - Show success toast                                    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 9. Re-render table with new row                           │
└────────────────────────────────────────────────────────────┘
```

### 4. Keyboard Navigation Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. User presses arrow keys (↑ ↓ ← →)                      │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 2. useCellCursor.handleKeyDown()                           │
│    - Check isEditing flag (skip if true)                   │
│    - Calculate new cursor position                         │
│    - Boundary checks (prevent overflow)                    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Update cellCursor state                                 │
│    setCellCursor({ rowIndex, columnIndex })                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 4. Announce to ARIA live region                           │
│    announceCell(rowIndex, columnIndex, value)              │
│    → "Row 3, Column Name, Value: Hello"                    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 5. DataTableCell receives isSelected=true                 │
│    - Renders with selection border                         │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 6. User presses Enter                                      │
│    → calls enterEditMode callback                          │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 7. useCellEdit.enterEditMode()                             │
│    - Sets editState for current cell                       │
│    - Renders EditableCell                                  │
└────────────────────────────────────────────────────────────┘
```

### 5. Column Reordering Flow

```
┌────────────────────────────────────────────────────────────┐
│ 1. User drags column header                               │
│    (DnD Kit handles drag start, move, end)                 │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 2. DnD context triggers handleDragEnd                     │
│    useColumnManagement.handleDragEnd(event)                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 3. Calculate new column order                             │
│    - Get active/over indices                               │
│    - Apply constraints (first/last columns locked)         │
│    - arrayMove(columnOrder, oldIndex, newIndex)            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 4. Update columnOrder state                                │
│    setColumnOrder(newOrder)                                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 5. TanStack Table reorders columns                        │
│    onColumnOrderChange callback                            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ 6. DataTableCell/Header re-render with new order          │
└────────────────────────────────────────────────────────────┘
```

## How Store, Hooks, and Components Relate

### 1. Store → Hooks Relationship

**Zustand Store** (`store.table.ts`) provides:
- Centralized state (tableData, isLoading, error, etc.)
- Actions to mutate state (setTableData, addPendingRowEdit, etc.)
- Cached instances per table

**useTable Hook** consumes the store:
```typescript
const store = getTableStore(datastoreId, tableName);
const tableData = useStore(store, (s) => s.tableData);
const isLoading = useStore(store, (s) => s.isLoading);
// ... more selectors
```

**Benefit**: Components don't directly access the store. The `useTable` hook acts as an abstraction layer, providing a clean API.

### 2. Hooks → Components Relationship

**useTable** is the orchestrator:
- Consumed by `DatastoreTable.tsx`
- Returns everything the component needs (table instance, data, actions)

**useColumnManagement** is consumed by `useTable`:
- Provides column definitions and DnD logic
- Outputs are passed to TanStack Table

**useCellCursor** and **useCellEdit** are consumed by `DatastoreTable`:
- Independent hooks for specific concerns
- Passed to child components via props

**Component Tree**:
```
DatastoreTable (uses useTable, useCellCursor, useCellEdit)
├─ DnD Context
│  └─ Table
│     ├─ thead
│     │  └─ DraggableTableHeader (for each column)
│     ├─ tbody
│     │  └─ tr (for each row)
│     │     └─ DataTableCell (for each cell)
│     │        └─ EditableCell (if editing)
│     └─ tfoot
│        ├─ NewRowEditor (for each pending row)
│        └─ AddRowButton
```

### 3. Store ← Hooks ← Components (Data Flow)

**Downward Flow (State → UI)**:
```
Store (state)
  ↓
useTable (selectors, derived state)
  ↓
DatastoreTable (props to children)
  ↓
DataTableCell, DraggableTableHeader, etc. (render UI)
```

**Upward Flow (User Actions → State)**:
```
User clicks/types in DataTableCell
  ↓
Callback (e.g., onCellDoubleClick)
  ↓
DatastoreTable handler
  ↓
useTable action (e.g., addPendingRowEdit)
  ↓
Store mutation (e.g., store.addPendingRowEdit)
  ↓
Re-render (Zustand triggers React update)
```

### 4. TanStack Table Integration

**TanStack Table** (`@tanstack/react-table`) is configured in `useTable`:
```typescript
const table = useReactTable({
  data: tableData,
  columns,           // From useColumnManagement
  columnOrder,       // From useColumnManagement
  onColumnOrderChange: setColumnOrder,
  getCoreRowModel: getCoreRowModel(),
});
```

**Components consume the table instance**:
- `table.getHeaderGroups()` → headers for `<thead>`
- `table.getRowModel().rows` → rows for `<tbody>`
- `header.column.columnDef` → column metadata

**Benefits**:
- Type-safe column definitions
- Built-in row/cell rendering helpers
- Column ordering, pinning, resizing APIs

### 5. DnD Kit Integration

**DnD Context** wraps the table in `DatastoreTable`:
```typescript
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  <table>...</table>
</DndContext>
```

**DraggableTableHeader** uses `useSortable`:
```typescript
const { attributes, listeners, setNodeRef, transform } = useSortable({
  id: header.column.id,
});
```

**Constraints**: First/last columns are locked (checkbox, add-column button).

### 6. API Client Integration

**RPC Client** (`@elysiajs/eden`) provides type-safe API calls:
```typescript
const response = await rpcClient.api.v1.datastore[datastoreId]
  .table[tableName].get({ query: { page, pageSize } });
```

**Used in**:
- `useTable`: Fetch data, POST new rows, PATCH edits
- Auto-fetch on pagination changes (store subscription)

**Type Safety**: Backend Elysia routes define types, Eden client auto-infers them.

## Architectural Patterns

### 1. Zustand Store for Global State

**Why Zustand?**
- Minimal boilerplate compared to Context API
- Efficient re-renders (selector-based)
- Supports middleware (persist, devtools)

**Caching Pattern**:
```typescript
const cachedStores = new Map<string, Store>();
export function getTableStore(id: string, name: string) {
  const key = `${id}:${name}`;
  if (!cachedStores.has(key)) {
    cachedStores.set(key, createTableStore(id, name));
  }
  return cachedStores.get(key)!;
}
```

**Benefit**: One store per table, prevents state conflicts when multiple tables are open.

### 2. Separation of Concerns with Hooks

Each hook has a single responsibility:

| Hook | Responsibility |
|------|----------------|
| `useTable` | Orchestration, API calls, TanStack Table setup |
| `useColumnManagement` | Column definitions, DnD logic |
| `useCellCursor` | Keyboard navigation, cursor position |
| `useCellEdit` | Edit state, save/cancel logic |

**Benefits**:
- Easier to test in isolation
- Clear ownership of logic
- Reusable across different components

### 3. Immer for State Updates

**Usage in `commitPendingEdits`**:
```typescript
import { produce, enableMapSet } from 'immer';
enableMapSet();  // Support Map/Set in Immer

store.setState(
  produce(draft => {
    draft.pendingRowEdits.clear();  // Mutate Map directly
    // Update tableData
  })
);
```

**Benefits**:
- Cleaner syntax (mutate draft, Immer creates new state)
- Supports complex structures (Map, Set)
- Reduces bugs from accidental mutations

### 4. Type Safety with TanStack Table

**Column Definitions**:
```typescript
const columns: ColumnDef<TableRow>[] = schema.columns.map(col => ({
  accessorKey: col.name,
  header: () => <DraggableTableHeader header={col} />,
  cell: ({ cell }) => <DataTableCell cell={cell} />,
}));
```

**Benefits**:
- TypeScript autocomplete for row properties
- Compile-time checks for column accessors
- Enforces consistent cell/header components

### 5. DnD Kit for Drag Operations

**Sensors**:
- Mouse, Touch, Keyboard (accessibility)

**Constraints**:
- First/last columns locked via custom logic in `handleDragEnd`

**Visual Feedback**:
- `transform` CSS for drag preview
- Opacity change while dragging

### 6. Component Composition

**Small, Focused Components**:
- `EditableCell`: Just the input logic
- `DataTableCell`: Just the cell rendering
- `DraggableTableHeader`: Just the header with DnD

**Props for Callbacks and State**:
- Parent (`DatastoreTable`) orchestrates
- Children receive specific props (e.g., `isSelected`, `isPending`)

**Benefits**:
- Easier to test individual components
- Clear data flow (props down, callbacks up)
- Reusable components

## Accessibility Features

### 1. ARIA Live Region

**Purpose**: Announce cell navigation and values to screen readers.

**Implementation**:
```typescript
const [announcement, setAnnouncement] = useState("");

const announceCell = (rowIndex: number, columnIndex: number, value: any) => {
  const columnName = columns[columnIndex]?.name || "Unknown";
  const valueText = value === null ? "NULL" : String(value);
  setAnnouncement(`Row ${rowIndex + 1}, ${columnName}, Value: ${valueText}`);
};

return (
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {announcement}
  </div>
);
```

### 2. Keyboard Navigation

**Full Table Navigation**:
- Arrow keys: Move cursor
- Enter: Edit cell
- Escape: Cancel edit

**Accessibility Notes**:
- All actions available via keyboard (no mouse required)
- Focus trapping during edit mode
- Restored focus after edit complete

### 3. ARIA Labels and Roles

**Semantic HTML**:
```html
<div role="application">
  <table role="grid">
    <thead>
      <tr role="row">
        <th role="columnheader">...</th>
      </tr>
    </thead>
    <tbody>
      <tr role="row">
        <td role="gridcell">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Button Labels**:
- `aria-label` on icon-only buttons (e.g., "Add row", "Commit changes")

### 4. Screen Reader Support

**NULL Values**:
- Announced as "NULL" explicitly
- Visual indicator (muted text)

**Editing Mode**:
- ARIA announcement: "Editing cell, Row X, Column Y"
- Clear feedback on save/cancel

### 5. Focus Management

**Focus Restoration**:
```typescript
const tableRef = useRef<HTMLTableElement>(null);

const saveEdit = () => {
  // ... save logic
  tableRef.current?.focus();  // Restore focus to table
};
```

**Benefits**:
- User doesn't lose position after edits
- Keyboard users can continue navigating

## Testing Considerations

### Unit Testing Hooks

**Example: Testing `useCellCursor`**:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useCellCursor } from './useCellCursor';

test('should move cursor on arrow keys', () => {
  const { result } = renderHook(() => useCellCursor(10, 5));

  act(() => {
    result.current.setCellCursor({ rowIndex: 0, columnIndex: 0 });
  });

  act(() => {
    result.current.handleKeyDown({
      key: 'ArrowRight',
      preventDefault: () => {},
    } as React.KeyboardEvent);
  });

  expect(result.current.cellCursor).toEqual({ rowIndex: 0, columnIndex: 1 });
});
```

### Integration Testing Components

**Example: Testing `DatastoreTable`**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { DatastoreTable } from './DatastoreTable';

test('should enter edit mode on double-click', async () => {
  render(<DatastoreTable datastoreId="1" tableName="users" />);

  const cell = await screen.findByRole('gridcell', { name: /John/ });
  fireEvent.doubleClick(cell);

  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('John');
});
```

### Mocking the Store

**Example: Mock Zustand store**:
```typescript
import { getTableStore } from './store/store.table';

jest.mock('./store/store.table', () => ({
  getTableStore: jest.fn(() => ({
    getState: () => ({
      tableData: [{ _rowid: '1', name: 'John' }],
      isLoading: false,
      error: null,
    }),
    setState: jest.fn(),
    subscribe: jest.fn(),
  })),
}));
```

## Best Practices

### 1. When to Use Datastore Feature

**Use when**:
- Need interactive table editing with real-time updates
- Want Excel-like keyboard navigation
- Need type-safe API integration with Elysia backend

**Don't use when**:
- Simple read-only table (use `@public/components/ui/Table` instead)
- Non-database data (feature assumes SQLite backend)

### 2. Extending the Feature

**Adding a New Column Type**:
1. Add to `SQLITE_DATA_TYPES` in `constants.ts`
2. Add icon to `column-type-icons.tsx`
3. Update type coercion in `useTable.tsx` (`savePendingNewRow`, `commitPendingEdits`)
4. Update `EditableCell.tsx` input type logic

**Adding a New Action**:
1. Add action to Zustand store (`store.table.ts`)
2. Expose via `useTable` hook
3. Call from component (e.g., new button in `DatastoreTable`)

### 3. Performance Considerations

**Optimization Strategies**:
- **Pagination**: Only fetch/render current page (not all data)
- **Memoization**: Use `useMemo` for derived data (e.g., filtered/sorted data)
- **Debouncing**: Debounce API calls for search/filter inputs
- **Virtualization**: For very large tables (100+ rows), consider `@tanstack/react-virtual`

**Current Limitations**:
- Batch commits are sequential (could parallelize PATCH requests)
- Full table re-render on any store update (could optimize selectors)

### 4. Error Handling

**Current Strategy**:
- Store `error` state for fetch failures
- Toast notifications for action errors (e.g., save failed)
- Rollback on API error (keep pendingRowEdits, allow retry)

**Improvements**:
- Optimistic updates (update UI immediately, rollback on error)
- Retry logic for transient failures
- Detailed error messages (e.g., validation errors per field)

## Public API

The feature exports the following via `index.ts`:

```typescript
// Main component
export { DatastoreTable } from "./DatastoreTable";

// Types
export type {
  DatastoreTableProps,
  TableRow,
  ColumnSchema,
  CellCursor,
  CellEditState,
  PendingChange,
  PendingChanges,
} from "./types";

// Constants
export { SQLITE_DATA_TYPES, type SQLiteDataType } from "./constants";

// Store (for advanced usage)
export { getTableStore, type TTableDataStore } from "./store/store.table";
```

**Usage Example**:
```typescript
import { DatastoreTable } from "@public/features/datastore";

function MyPage() {
  return <DatastoreTable datastoreId="abc123" tableName="users" />;
}
```

## File References

All files relative to `/Users/omarezzat/Workspace/ecliptic-repos/ecliptic-oss/`:

- Main Component: `public/features/datastore/DatastoreTable.tsx:1`
- Main Hook: `public/features/datastore/hooks/useTable.tsx:1`
- Column Management: `public/features/datastore/hooks/useColumnManagement.tsx:1`
- Navigation Hook: `public/features/datastore/hooks/useCellCursor.ts:1`
- Edit Hook: `public/features/datastore/hooks/useCellEdit.ts:1`
- Store: `public/features/datastore/store/store.table.ts:1`
- Types: `public/features/datastore/types.ts:1`
- Constants: `public/features/datastore/constants.ts:1`
- Cell Component: `public/features/datastore/components/DataTableCell.tsx:1`
- Editable Cell: `public/features/datastore/components/EditableCell.tsx:1`
- Header: `public/features/datastore/components/DraggableTableHeader.tsx:1`
- Add Row: `public/features/datastore/components/AddRowButton.tsx:1`
- New Row Editor: `public/features/datastore/components/NewRowEditor.tsx:1`
- Add Column: `public/features/datastore/components/AddColumnDropdown.tsx:1`

## Recent Changes

Based on recent commit history:

1. **Enhanced commit handling**: Improved batch commit logic with better error handling
2. **Type safety improvements**: Refactored data handling for stricter TypeScript checks
3. **Cell editing enhancements**: Better UX for editing cells (focus, selection, keyboard)
4. **Pending row management**: Cleaner state management for new rows

---

This feature demonstrates a complete implementation of the Feature Folder Pattern with:
- Clear separation of concerns (hooks, components, store)
- Type-safe API integration
- Rich interactivity (DnD, keyboard navigation, inline editing)
- Accessibility-first design
- Production-ready error handling and state management
