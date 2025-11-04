import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { globalStore } from "@public/store/store.global";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { RenameColumnMetadata } from "../../types";

interface RenameColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: RenameColumnMetadata | null;
}

export function RenameColumnDialog({
  open,
  onOpenChange,
  metadata,
}: RenameColumnDialogProps) {
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const currentName = metadata?.columnName || "";
  const tableName = metadata?.tableName || "";

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setNewName("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (currentName.trim() && newName.trim() && metadata && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).schema.patch({
          type: "rename-column",
          table: metadata.tableName,
          column: currentName.trim(),
          new_name: newName.trim(),
        });

        if (error) {
          toast.error("Failed to rename column", {
            description: error.value?.message || "An error occurred while renaming the column",
          });
          return;
        }

        toast.success("Column renamed successfully", {
          description: `Column "${currentName}" in table "${tableName}" has been renamed to "${newName.trim()}"`,
        });

        // Refresh global store to update datastore schemas
        await initialLoading();

        setNewName("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to rename column", {
          description: "An unexpected error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNewName("");
    }
    onOpenChange(open);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Rename Column"
      description={`Enter a new name for the column "${currentName}" in table "${tableName}".`}
      onConfirm={handleConfirm}
      confirmText="Rename Column"
      confirmDisabled={!newName.trim() || isLoading}
    >
      <div className="space-y-4">
        <div className="rounded-md bg-muted p-3 text-sm">
          Current name: <span className="font-mono font-semibold">{currentName}</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-column-name">New Column Name</Label>
          <Input
            id="new-column-name"
            placeholder={`e.g., ${currentName}_new`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                handleConfirm();
              }
            }}
          />
        </div>
      </div>
    </ActionDialog>
  );
}
