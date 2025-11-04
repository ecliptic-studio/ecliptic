import { useState } from "react";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { toast } from "sonner";

interface DeleteDatastoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  datastoreName: string;
  datastoreId: string;
}

export function DeleteDatastoreDialog({
  open,
  onOpenChange,
  onConfirm,
  datastoreName,
  datastoreId,
}: DeleteDatastoreDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmationValid = confirmationText === datastoreName;

  const handleConfirm = async () => {
    if (isConfirmationValid && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore[datastoreId].delete();

        if (error) {
          toast.error("Failed to delete datastore", {
            description: error.value?.message || "An error occurred while deleting the datastore",
          });
          return;
        }

        toast.success("Datastore deleted successfully", {
          description: `Datastore "${datastoreName}" has been permanently deleted`,
        });

        onConfirm();
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
            Type <span className="font-mono font-semibold">{datastoreName}</span> to confirm
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
