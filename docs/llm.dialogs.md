# Dialog System (Type-Safe Registry Pattern)

The dialog system provides centralized, type-safe dialog management using a registry pattern. Dialogs can be triggered from anywhere in the application with full TypeScript type checking.

If the dialog makes external state changes (via api). Make sure that if that data is part of the global store you update the @public/store/store.global.ts

## Architecture Overview

The dialog system consists of three key parts:

1. **Dialog Registry** - Maps dialog names to their required metadata types
2. **Dialog Provider** - Manages dialog state and renders all registered dialogs
3. **Dialog Hook** - Type-safe API for opening/closing dialogs

## When to Use This Pattern

Use the centralized dialog system when:
- **Multiple locations** need to trigger the same dialog (e.g., AppSidebar, page header)
- **Type safety** is important - ensure correct metadata for each dialog
- **Centralized state** simplifies dialog management
- **Feature-related dialogs** work together (e.g., datastore CRUD operations)

**Don't use this pattern for:**
- One-off dialogs used in a single component (use local state)
- Simple alerts/confirms (use a simpler modal component)
- Dialogs with no shared state or metadata

## Dialog Feature Structure

Dialogs are organized as a feature:

```
@public/features/datastore-dialogs/
├── index.ts                        # Public exports
├── types.ts                        # Dialog registry and metadata types
├── DatastoreDialogsProvider.tsx    # Provider with dialog state
└── components/                     # Dialog components
    ├── AddTableDialog.tsx
    ├── RenameTableDialog.tsx
    ├── DeleteTableDialog.tsx
    └── DeleteDatastoreDialog.tsx
```

## Step 1: Define Dialog Registry

The registry is the source of truth for type safety.

```typescript
// @public/features/datastore-dialogs/types.ts

/**
 * Metadata types - what each dialog needs to operate
 */

export interface AddTableMetadata {
  datastoreId: string;
  tableName?: string;  // Optional context
}

export interface RenameTableMetadata {
  datastoreId: string;
  tableName: string;
  currentTableName?: string;
}

export interface DeleteTableMetadata {
  datastoreId: string;
  tableName?: string;
}

export interface DeleteDatastoreMetadata {
  datastoreId: string;
  datastoreName: string;
}

/**
 * Dialog Registry - Maps dialog names to metadata types
 * This enables type-safe dialog opening
 */
export interface DatastoreDialogRegistry {
  addTable: AddTableMetadata;
  renameTable: RenameTableMetadata;
  deleteTable: DeleteTableMetadata;
  deleteDatastore: DeleteDatastoreMetadata;
}

/**
 * Dialog names - extracted from registry keys
 */
export type DatastoreDialogName = keyof DatastoreDialogRegistry;

/**
 * Dialog state - tracks open/closed and metadata
 */
export interface DialogState<T = unknown> {
  open: boolean;
  metadata: T | null;
}

/**
 * Type-safe dialog opener function
 * Metadata type is automatically inferred from dialog name
 */
export type OpenDialogFn = <K extends DatastoreDialogName>(
  name: K,
  metadata: DatastoreDialogRegistry[K]
) => void;

/**
 * Close dialog function
 */
export type CloseDialogFn = (name: DatastoreDialogName) => void;
```

### Key Type Safety Features

The registry provides compile-time type checking:

```typescript
// ✅ Correct - TypeScript knows addTable needs datastoreId
openDialog("addTable", { datastoreId: "123" });

// ❌ Compile error - Missing required field
openDialog("addTable", {}); // Error: Property 'datastoreId' is missing

// ❌ Compile error - Wrong metadata type
openDialog("renameTable", { datastoreId: "123" }); // Error: Missing 'tableName'

// ✅ Correct - All required fields present
openDialog("renameTable", {
  datastoreId: "123",
  tableName: "users"
});
```

## Step 2: Create Dialog Provider

The provider manages all dialog state and renders dialogs.

```typescript
// @public/features/datastore-dialogs/DatastoreDialogsProvider.tsx

import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  DatastoreDialogName,
  DatastoreDialogRegistry,
  DialogState,
  OpenDialogFn,
  CloseDialogFn,
} from "./types";

// Import dialog components
import { AddTableDialog } from "./components/AddTableDialog";
import { RenameTableDialog } from "./components/RenameTableDialog";
import { DeleteTableDialog } from "./components/DeleteTableDialog";
import { DeleteDatastoreDialog } from "./components/DeleteDatastoreDialog";

/**
 * Context value interface
 */
interface DatastoreDialogsContextValue {
  openDialog: OpenDialogFn;
  closeDialog: CloseDialogFn;
}

/**
 * Create context
 */
const DatastoreDialogsContext = createContext<DatastoreDialogsContextValue | null>(null);

/**
 * Provider props
 */
interface DatastoreDialogsProviderProps {
  children: ReactNode;
}

/**
 * Provider component
 * This provider is generic and has no knowledge of individual dialogs
 * Dialogs self-describe their metadata needs via the registry
 */
export function DatastoreDialogsProvider({ children }: DatastoreDialogsProviderProps) {
  // State for all dialogs - keyed by dialog name
  const [dialogStates, setDialogStates] = useState<
    Record<DatastoreDialogName, DialogState>
  >({
    addTable: { open: false, metadata: null },
    renameTable: { open: false, metadata: null },
    deleteTable: { open: false, metadata: null },
    deleteDatastore: { open: false, metadata: null },
  });

  /**
   * Type-safe dialog opener
   * TypeScript enforces that metadata matches the dialog's required type
   */
  const openDialog: OpenDialogFn = (name, metadata) => {
    setDialogStates((prev) => ({
      ...prev,
      [name]: { open: true, metadata },
    }));
  };

  /**
   * Close a dialog and clear its metadata
   */
  const closeDialog: CloseDialogFn = (name) => {
    setDialogStates((prev) => ({
      ...prev,
      [name]: { open: false, metadata: null },
    }));
  };

  return (
    <DatastoreDialogsContext.Provider value={{ openDialog, closeDialog }}>
      {children}

      {/* Render all dialogs - they control their own visibility */}
      <AddTableDialog
        open={dialogStates.addTable.open}
        onOpenChange={(open) => !open && closeDialog("addTable")}
        metadata={dialogStates.addTable.metadata}
      />

      <RenameTableDialog
        open={dialogStates.renameTable.open}
        onOpenChange={(open) => !open && closeDialog("renameTable")}
        metadata={dialogStates.renameTable.metadata}
      />

      <DeleteTableDialog
        open={dialogStates.deleteTable.open}
        onOpenChange={(open) => !open && closeDialog("deleteTable")}
        metadata={dialogStates.deleteTable.metadata}
      />

      <DeleteDatastoreDialog
        open={dialogStates.deleteDatastore.open}
        onOpenChange={(open) => !open && closeDialog("deleteDatastore")}
        metadata={dialogStates.deleteDatastore.metadata}
      />
    </DatastoreDialogsContext.Provider>
  );
}

/**
 * Hook to access dialog controls
 * Usage:
 *   const { openDialog } = useDatastoreDialogs()
 *   openDialog("addTable", { datastoreId: "123" })
 */
export function useDatastoreDialogs() {
  const context = useContext(DatastoreDialogsContext);
  if (!context) {
    throw new Error(
      "useDatastoreDialogs must be used within DatastoreDialogsProvider"
    );
  }
  return context;
}
```

### Provider Pattern Principles

1. **Generic Implementation** - Provider doesn't know about specific dialogs
2. **All Dialogs Rendered** - Dialogs are always in the DOM, controlled by `open` prop
3. **Metadata Passing** - Each dialog receives its metadata when opened
4. **Centralized State** - Single source of truth for all dialog states

## Step 3: Create Dialog Components

Each dialog is a controlled component that receives metadata.

```typescript
// @public/features/datastore-dialogs/components/AddTableDialog.tsx

import { useState, useEffect } from "react";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import type { AddTableMetadata } from "../types";

interface AddTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: AddTableMetadata | null;
}

export function AddTableDialog({
  open,
  onOpenChange,
  metadata,
}: AddTableDialogProps) {
  const [tableName, setTableName] = useState("");

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTableName("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (tableName.trim() && metadata) {
      console.log("Adding table:", {
        datastoreId: metadata.datastoreId,
        tableName: tableName.trim(),
      });
      // TODO: Call API to create table
      setTableName("");
      onOpenChange(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Table"
      description="Enter a name for the new table."
      onConfirm={handleConfirm}
      confirmText="Add Table"
      confirmDisabled={!tableName.trim()}
    >
      <div className="space-y-2">
        <Label htmlFor="table-name">Table Name</Label>
        <Input
          id="table-name"
          placeholder="e.g., products"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tableName.trim()) {
              handleConfirm();
            }
          }}
        />
      </div>
    </ActionDialog>
  );
}
```

### Dialog Component Principles

1. **Controlled Component** - Parent manages `open` state via props
2. **Metadata Prop** - Receives context data it needs to operate
3. **Form State** - Manages its own form inputs locally
4. **Reset on Close** - Clear form when dialog closes
5. **Null Safety** - Check `metadata` exists before using it

### Dialog with Context from Metadata

For dialogs that need to show context (like renaming), display the existing value from metadata rather than making the user re-enter it:

```typescript
export function RenameTableDialog({ open, metadata }: Props) {
  const [newName, setNewName] = useState("");

  // Get current name from metadata (no input field needed)
  const currentName = metadata?.tableName || "";

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setNewName("");
    }
  }, [open]);

  return (
    <ActionDialog title="Rename Table" /* ... */>
      <div className="space-y-4">
        {/* Show current name as read-only context */}
        <div className="rounded-md bg-muted p-3 text-sm">
          Current name: <span className="font-mono font-semibold">{currentName}</span>
        </div>

        {/* Only ask for the new value */}
        <div className="space-y-2">
          <Label>New Table Name</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
      </div>
    </ActionDialog>
  );
}
```

**Key UX principle:** Don't make users re-type information they already provided. Pass it via metadata and display it as context.

## Step 4: Register Provider in App

Wrap your app with the provider (typically at the root level):

```typescript
// @public/App.tsx

import { DatastoreDialogsProvider } from "@public/features/datastore-dialogs";

export function App() {
  return (
    <BrowserRouter>
      <HeaderProvider>
        <DatastoreDialogsProvider>
          <Routes>
            {/* Your routes */}
          </Routes>
        </DatastoreDialogsProvider>
      </HeaderProvider>
    </BrowserRouter>
  );
}
```

**Provider Placement:**
- Place high in the tree so all components can access it
- After authentication providers (if dialogs need auth)
- Before route components that will use dialogs

## Step 5: Use Dialogs Anywhere

### Basic Usage

```typescript
import { useDatastoreDialogs } from "@public/features/datastore-dialogs";

function MyComponent() {
  const { openDialog } = useDatastoreDialogs();

  return (
    <button
      onClick={() =>
        openDialog("addTable", {
          datastoreId: "datastore-123",
        })
      }
    >
      Add Table
    </button>
  );
}
```

### Usage in Sidebar

```typescript
function AppSidebar() {
  const { openDialog } = useDatastoreDialogs();
  const datastores = useStore(globalStore, (state) => state.datastores);

  return (
    <div>
      {datastores.map((datastore) => (
        <div key={datastore.id}>
          <span>{datastore.internal_name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger>⋮</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  openDialog("addTable", {
                    datastoreId: datastore.id,
                  })
                }
              >
                Add Table
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openDialog("deleteDatastore", {
                    datastoreId: datastore.id,
                    datastoreName: datastore.internal_name,
                  })
                }
              >
                Delete Datastore
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
```

### Usage in Page Header

```typescript
function DatastoreTablePage() {
  const { openDialog } = useDatastoreDialogs();
  const { id, tableName } = useParams();

  return (
    <div>
      <header>
        <h1>Table: {tableName}</h1>
        <DropdownMenu>
          <DropdownMenuItem
            onClick={() =>
              openDialog("renameTable", {
                datastoreId: id!,
                tableName: tableName!,
                currentTableName: tableName,
              })
            }
          >
            Rename Table
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              openDialog("deleteTable", {
                datastoreId: id!,
                tableName: tableName!,
              })
            }
          >
            Delete Table
          </DropdownMenuItem>
        </DropdownMenu>
      </header>

      {/* Page content */}
    </div>
  );
}
```

## Advanced Patterns

### Dialog Callbacks

For actions after dialog completion:

```typescript
// Add callback to metadata
export interface AddTableMetadata {
  datastoreId: string;
  onSuccess?: (tableName: string) => void;
}

// Dialog calls callback
function AddTableDialog({ metadata }: Props) {
  const handleConfirm = async () => {
    const result = await createTable(metadata.datastoreId, tableName);
    if (result) {
      metadata.onSuccess?.(tableName);
    }
  };
}

// Usage with callback
openDialog("addTable", {
  datastoreId: "123",
  onSuccess: (tableName) => {
    console.log(`Table ${tableName} created!`);
    navigate(`/datastore/123/table/${tableName}`);
  },
});
```

### Confirmation Dialogs

For destructive actions with confirmation:

```typescript
export function DeleteDatastoreDialog({ metadata }: Props) {
  const [confirmationText, setConfirmationText] = useState("");

  const datastoreName = metadata?.datastoreName || "";
  const isValid = confirmationText === datastoreName;

  return (
    <ActionDialog
      title="Delete Datastore"
      onConfirm={handleDelete}
      confirmDisabled={!isValid}
      confirmVariant="destructive"
    >
      <div className="space-y-4">
        <div className="bg-destructive/10 p-3 text-destructive">
          Warning: This will permanently delete the datastore and all its data.
        </div>
        <Label>
          Type <strong>{datastoreName}</strong> to confirm
        </Label>
        <Input
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          placeholder={`Type "${datastoreName}" to confirm`}
        />
      </div>
    </ActionDialog>
  );
}
```

### Multi-Step Dialogs

For complex workflows:

```typescript
export function CreateDatastoreDialog({ metadata }: Props) {
  const [step, setStep] = useState<"name" | "provider" | "config">("name");
  const [formData, setFormData] = useState({
    name: "",
    provider: "sqlite" as const,
    region: "",
  });

  const handleNext = () => {
    if (step === "name") setStep("provider");
    else if (step === "provider") setStep("config");
  };

  const handleBack = () => {
    if (step === "config") setStep("provider");
    else if (step === "provider") setStep("name");
  };

  return (
    <ActionDialog
      title={`Create Datastore - Step ${step}`}
      onConfirm={step === "config" ? handleCreate : handleNext}
      confirmText={step === "config" ? "Create" : "Next"}
    >
      {step === "name" && <NameStep data={formData} onChange={setFormData} />}
      {step === "provider" && <ProviderStep data={formData} onChange={setFormData} />}
      {step === "config" && <ConfigStep data={formData} onChange={setFormData} />}

      {step !== "name" && (
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
      )}
    </ActionDialog>
  );
}
```

## Adding New Dialogs

To add a new dialog to the system:

1. **Define metadata type** in `types.ts`
2. **Add to registry** in `DatastoreDialogRegistry`
3. **Create dialog component** in `components/`
4. **Register in provider** - add to initial state and render list
5. **Use anywhere** via `openDialog()`

Example:

```typescript
// 1. Define metadata
export interface ExportDataMetadata {
  datastoreId: string;
  format: "csv" | "json" | "sql";
}

// 2. Add to registry
export interface DatastoreDialogRegistry {
  // ... existing dialogs
  exportData: ExportDataMetadata;
}

// 3. Create component
export function ExportDataDialog({ open, metadata }: Props) {
  // ... implementation
}

// 4. Register in provider
const [dialogStates, setDialogStates] = useState({
  // ... existing states
  exportData: { open: false, metadata: null },
});

// And in render:
<ExportDataDialog
  open={dialogStates.exportData.open}
  onOpenChange={(open) => !open && closeDialog("exportData")}
  metadata={dialogStates.exportData.metadata}
/>

// 5. Use it
openDialog("exportData", {
  datastoreId: "123",
  format: "csv",
});
```

## Testing Dialogs

### Testing the Provider

```typescript
import { render, screen } from '@testing-library/react';
import { DatastoreDialogsProvider, useDatastoreDialogs } from './index';

describe('DatastoreDialogsProvider', () => {
  it('should open dialog with correct metadata', () => {
    function TestComponent() {
      const { openDialog } = useDatastoreDialogs();

      return (
        <button onClick={() => openDialog("addTable", { datastoreId: "123" })}>
          Open Dialog
        </button>
      );
    }

    render(
      <DatastoreDialogsProvider>
        <TestComponent />
      </DatastoreDialogsProvider>
    );

    const button = screen.getByText('Open Dialog');
    button.click();

    // Dialog should be visible
    expect(screen.getByText('Add New Table')).toBeInTheDocument();
  });
});
```

### Testing Individual Dialogs

```typescript
import { render, screen } from '@testing-library/react';
import { AddTableDialog } from './AddTableDialog';

describe('AddTableDialog', () => {
  it('should render with metadata', () => {
    const metadata = { datastoreId: "123" };

    render(
      <AddTableDialog
        open={true}
        onOpenChange={() => {}}
        metadata={metadata}
      />
    );

    expect(screen.getByLabelText('Table Name')).toBeInTheDocument();
  });

  it('should call onConfirm with correct data', async () => {
    const onConfirm = jest.fn();
    // ... test confirmation logic
  });
});
```

## Benefits of This Pattern

1. **Type Safety** - Compile-time checking of metadata
2. **Centralization** - Single source of truth for dialogs
3. **Reusability** - Trigger same dialog from multiple places
4. **Maintainability** - Clear structure, easy to add new dialogs
5. **Flexibility** - Dialogs can be opened with different contexts
6. **Testability** - Easy to test dialogs in isolation

## Complete Example

See `@public/features/datastore-dialogs/` for the complete reference implementation of this pattern in action.
