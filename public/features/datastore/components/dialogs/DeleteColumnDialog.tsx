import apis from "@public/api-calls";
import { ActionDialog } from "@public/components/ActionDialog";
import { globalStore } from "@public/store/store.global";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { DeleteColumnMetadata } from "../../types";

interface DeleteColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DeleteColumnMetadata | null;
}

export function DeleteColumnDialog({
  open,
  onOpenChange,
  metadata,
}: DeleteColumnDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const columnName = metadata?.columnName || "";
  const tableName = metadata?.tableName || "";

  const handleConfirm = async () => {
    if (!metadata || isLoading) return;

    setIsLoading(true);
    try {
      const [data, error] = await apis["/api/v1/datastore/:id/schema"].PATCH({id: metadata.datastoreId}, {
        type: "drop-column",
        table: metadata.tableName,
        column: metadata.columnName,
      })

      if (error) {
        toast.error("Failed to delete column", {
          description: error
        });
        return;
      }

      toast.success("Column deleted successfully", {
        description: `Column "${columnName}" has been removed from table "${tableName}"`,
      });

      // Refresh global store to update datastore schemas
      await initialLoading();

      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete column", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Column"
      description={`Are you sure you want to delete the column "${columnName}" from table "${tableName}"?`}
      onConfirm={handleConfirm}
      confirmText="Delete Column"
      confirmDisabled={isLoading}
      confirmVariant="destructive"
    >
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        <strong>Warning:</strong> This action cannot be undone. All data in this column will be permanently deleted.
      </div>
    </ActionDialog>
  );
}
