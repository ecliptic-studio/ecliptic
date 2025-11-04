import { useState, useEffect } from "react";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { useStore } from "zustand";
import rpcClient from "@public/rpc-client";
import { toast } from "sonner";
import { globalStore, type TGlobalStore } from "@public/store/store.global";
import type { RenameTableMetadata } from "../../types";
import { produce } from "immer";
import { useLocation, useNavigate } from "react-router-dom";

interface RenameTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: RenameTableMetadata | null;
}

export function RenameTableDialog({
  open,
  onOpenChange,
  metadata,
}: RenameTableDialogProps) {
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const currentName = metadata?.tableName || "";

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setNewName("");
    }
  }, [open]);

  const location = useLocation();
  
  const handleConfirm = async () => {
    if (currentName.trim() && newName.trim() && metadata && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).schema.patch({
          type: "rename-table",
          table: currentName.trim(),
          new_name: newName.trim(),
        });

        if (error) {
          toast.error("Failed to rename table", {
            description: error.value?.message || "An error occurred while renaming the table",
          });
          return;
        }

        globalStore.setState(produce((state: TGlobalStore) => {
          let datastore = state.datastores.find((ds) => ds.id === metadata.datastoreId);
          if (datastore) {
            datastore = data
          }
        }))

        if(location.pathname === `/datastore/${metadata.datastoreId}/table/${currentName}`) {
          window.location.href = `/datastore/${metadata.datastoreId}/table/${newName.trim()}`;
        }

        toast.success("Table renamed successfully", {
          description: `Table "${currentName}" has been renamed to "${newName.trim()}"`,
        });

        // Refresh global store to update datastore schemas
        await initialLoading();

        setNewName("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to rename table", {
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
      title="Rename Table"
      description={`Enter a new name for the table "${currentName}".`}
      onConfirm={handleConfirm}
      confirmText="Rename Table"
      confirmDisabled={!newName.trim() || isLoading}
    >
      <div className="space-y-4">
        <div className="rounded-md bg-muted p-3 text-sm">
          Current name: <span className="font-mono font-semibold">{currentName}</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-table-name">New Table Name</Label>
          <Input
            id="new-table-name"
            placeholder={`e.g., ${currentName}_v2`}
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
