import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { globalStore } from "@public/store/store.global";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { DeleteDatastoreMetadata } from "../../types";

interface DeleteDatastoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DeleteDatastoreMetadata | null;
}

export function DeleteDatastoreDialog({
  open,
  onOpenChange,
  metadata,
}: DeleteDatastoreDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const datastoreName = metadata?.datastoreName || "";
  const isConfirmationValid = confirmationText === datastoreName;

  // Reset confirmation when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmationText("");
    }
  }, [open]);

  const handleConfirm = async () => {
    if (isConfirmationValid && metadata && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).delete();

        if (error) {
          toast.error("Failed to delete datastore", {
            description: error.value?.message || "An error occurred while deleting the datastore",
          });
          return;
        }

        toast.success("Datastore deleted successfully", {
          description: `Datastore "${metadata.datastoreName}" has been permanently deleted`,
        });

        // Refresh global store to remove deleted datastore
        await initialLoading();

        setConfirmationText("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to delete datastore", {
          description: "An unexpected error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationText("");
    }
    onOpenChange(open);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Delete Datastore"
      description="This action cannot be undone. All data in this datastore will be permanently deleted."
      onConfirm={handleConfirm}
      confirmText="Delete Datastore"
      confirmDisabled={!isConfirmationValid || isLoading}
      confirmVariant="destructive"
    >
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Warning: This will permanently delete the datastore and all its data.
        </div>
        <div className="space-y-2">
          <Label htmlFor="datastore-confirmation">
            Type{" "}
            <span className="font-mono font-semibold">{datastoreName}</span> to
            confirm
          </Label>
          <Input
            id="datastore-confirmation"
            placeholder={`Type "${datastoreName}" to confirm`}
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmationValid) {
                handleConfirm();
              }
            }}
          />
        </div>
      </div>
    </ActionDialog>
  );
}
