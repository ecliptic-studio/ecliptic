import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { globalStore } from "@public/store/store.global";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { AddTableMetadata } from "../../types";

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
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTableName("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (tableName.trim() && metadata && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).schema.patch({
          type: "add-table",
          table: tableName.trim(),
        });

        if (error) {
          toast.error("Failed to add table", {
            description: error.value?.message || "An error occurred while adding the table",
          });
          return;
        }

        toast.success("Table added successfully", {
          description: `Table "${tableName.trim()}" has been created`,
        });

        // Refresh global store to update datastore schemas
        await initialLoading();

        setTableName("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to add table", {
          description: "An unexpected error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTableName("");
    }
    onOpenChange(open);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add New Table"
      description="Enter a name for the new table."
      onConfirm={handleConfirm}
      confirmText="Add Table"
      confirmDisabled={!tableName.trim() || isLoading}
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
