import apis from "@public/api-calls";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { globalStore } from "@public/store/store.global";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { DeleteTableMetadata } from "../../types";

interface DeleteTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DeleteTableMetadata | null;
}

export function DeleteTableDialog({
  open,
  onOpenChange,
  metadata,
}: DeleteTableDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const tableName = metadata?.tableName || "";
  const isConfirmationValid = confirmationText === tableName;

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

        const [data, error] = await apis["/api/v1/datastore/:id/schema"].PATCH({id: metadata.datastoreId}, {
          type: "drop-table",
          table: tableName.trim(),
        })

        if (error) {
          toast.error("Failed to delete table", {
            description: error
          });
          return;
        }

        toast.success("Table deleted successfully", {
          description: `Table "${tableName}" has been deleted`,
        });

        // Refresh global store to update datastore schemas
        await initialLoading();

        setConfirmationText("");
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to delete table", {
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
      title="Delete Table"
      description="This action cannot be undone. All data in this table will be permanently deleted."
      onConfirm={handleConfirm}
      confirmText="Delete Table"
      confirmDisabled={!isConfirmationValid || isLoading}
      confirmVariant="destructive"
    >
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Warning: This will permanently delete the table "{tableName}" and all its data.
        </div>
        <div className="space-y-2">
          <Label htmlFor="table-confirmation">
            Type{" "}
            <span className="font-mono font-semibold">{tableName}</span> to
            confirm
          </Label>
          <Input
            id="table-confirmation"
            placeholder={`Type "${tableName}" to confirm`}
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
