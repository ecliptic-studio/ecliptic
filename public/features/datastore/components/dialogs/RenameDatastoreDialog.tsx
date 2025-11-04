import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { globalStore, type TGlobalStore } from "@public/store/store.global";
import { produce } from "immer";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { RenameDatastoreMetadata } from "../../types";

interface RenameDatastoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: RenameDatastoreMetadata | null;
}

export function RenameDatastoreDialog({
  open,
  onOpenChange,
  metadata,
}: RenameDatastoreDialogProps) {
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const currentName = metadata?.datastoreName || "";

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
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).patch({
          internalName: newName.trim(),
        });

        if (error) {
          toast.error("Failed to rename datastore", {
            description: error.value?.message || "An error occurred while renaming the datastore",
          });
          return;
        }

        // Update global store with new datastore data
        globalStore.setState(
          produce((state: TGlobalStore) => {
            const datastoreIndex = state.datastores.findIndex((ds) => ds.id === metadata.datastoreId);
            if (datastoreIndex !== -1 && data) {
              state.datastores[datastoreIndex] = data;
            }
          })
        );

        toast.success("Datastore renamed successfully", {
          description: `Datastore "${currentName}" has been renamed to "${newName.trim()}"`,
        });

        // Refresh global store to ensure consistency
        await initialLoading();

        setNewName("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to rename datastore", {
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
      title="Rename Datastore"
      description={`Enter a new name for the datastore "${currentName}".`}
      onConfirm={handleConfirm}
      confirmText="Rename Datastore"
      confirmDisabled={!newName.trim() || isLoading}
    >
      <div className="space-y-4">
        <div className="rounded-md bg-muted p-3 text-sm">
          Current name: <span className="font-mono font-semibold">{currentName}</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-datastore-name">New Datastore Name</Label>
          <Input
            id="new-datastore-name"
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
