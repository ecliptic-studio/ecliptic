import { useContext } from "react";
import { DatastoreDialogsContext } from "../DatastoreDialogsProvider";

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
