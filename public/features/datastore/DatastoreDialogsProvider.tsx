import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  DatastoreDialogName,
  DatastoreDialogRegistry,
  DialogState,
  OpenDialogFn,
  CloseDialogFn,
} from "./types";

// Import dialog components
import { AddTableDialog } from "./components/dialogs/AddTableDialog";
import { RenameTableDialog } from "./components/dialogs/RenameTableDialog";
import { DeleteTableDialog } from "./components/dialogs/DeleteTableDialog";
import { DeleteDatastoreDialog } from "./components/dialogs/DeleteDatastoreDialog";
import { RenameDatastoreDialog } from "./components/dialogs/RenameDatastoreDialog";
import { AddColumnDialog } from "./components/dialogs/AddColumnDialog";
import { RenameColumnDialog } from "./components/dialogs/RenameColumnDialog";
import { DeleteColumnDialog } from "./components/dialogs/DeleteColumnDialog";

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
export const DatastoreDialogsContext = createContext<DatastoreDialogsContextValue | null>(null);

/**
 * Provider props
 */
interface DatastoreDialogsProviderProps {
  children: ReactNode;
}

/**
 * Provider component - manages all datastore dialog state
 * This provider is generic and has no knowledge of individual dialogs
 * Dialogs are registered and rendered based on the registry type
 */
export function DatastoreDialogsProvider({ children }: DatastoreDialogsProviderProps) {
  // State for all dialogs - keyed by dialog name
  // Each dialog state is typed to match its metadata from the registry
  const [dialogStates, setDialogStates] = useState<{
    [K in DatastoreDialogName]: DialogState<DatastoreDialogRegistry[K]>;
  }>({
    addTable: { open: false, metadata: null },
    renameTable: { open: false, metadata: null },
    deleteTable: { open: false, metadata: null },
    deleteDatastore: { open: false, metadata: null },
    renameDatastore: { open: false, metadata: null },
    addColumn: { open: false, metadata: null },
    renameColumn: { open: false, metadata: null },
    deleteColumn: { open: false, metadata: null },
  });

  /**
   * Type-safe dialog opener
   * TypeScript will enforce that metadata matches the dialog name's required type
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

      {/* Render all dialogs - they control their own visibility based on state */}
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

      <RenameDatastoreDialog
        open={dialogStates.renameDatastore.open}
        onOpenChange={(open) => !open && closeDialog("renameDatastore")}
        metadata={dialogStates.renameDatastore.metadata}
      />

      <AddColumnDialog
        open={dialogStates.addColumn.open}
        onOpenChange={(open) => !open && closeDialog("addColumn")}
        metadata={dialogStates.addColumn.metadata}
      />

      <RenameColumnDialog
        open={dialogStates.renameColumn?.open}
        onOpenChange={(open) => !open && closeDialog("renameColumn")}
        metadata={dialogStates.renameColumn.metadata}
      />

      <DeleteColumnDialog
        open={dialogStates.deleteColumn.open}
        onOpenChange={(open) => !open && closeDialog("deleteColumn")}
        metadata={dialogStates.deleteColumn.metadata}
      />
    </DatastoreDialogsContext.Provider>
  );
}