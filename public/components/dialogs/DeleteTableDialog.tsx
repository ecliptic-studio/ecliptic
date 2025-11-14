import apis from "@public/api-calls";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tableName: string) => void;
  datastoreId: string;
}

export function DeleteTableDialog({
  open,
  onOpenChange,
  onConfirm,
  datastoreId,
}: DeleteTableDialogProps) {
  const [tableName, setTableName] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmationValid = confirmationText === tableName && tableName.trim() !== "";

  const handleConfirm = async () => {
    if (isConfirmationValid && !isLoading) {
      setIsLoading(true);
      try {
        const [data, error] = await apis["/api/v1/datastore/:id/schema"].PATCH({id: datastoreId}, {
          type: 'drop-table',
          table: tableName.trim(),
        })

        if (error) {
          toast.error("Failed to delete table", {
            description: error
          });
          return;
        }

        toast.success("Table deleted successfully", {
          description: `Table "${tableName.trim()}" has been deleted`,
        });

        onConfirm(tableName.trim());
        setTableName("");
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
      setTableName("");
      setConfirmationText("");
    }
    onOpenChange(open);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Delete Table"
      description="This action cannot be undone. Type the table name to confirm deletion."
      onConfirm={handleConfirm}
      confirmText="Delete Table"
      confirmDisabled={!isConfirmationValid || isLoading}
      confirmVariant="destructive"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="table-name-to-delete">Table Name</Label>
          <Input
            id="table-name-to-delete"
            placeholder="Enter the table name"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation-text">
            Type <span className="font-mono font-semibold">{tableName || "[table name]"}</span> to confirm
          </Label>
          <Input
            id="confirmation-text"
            placeholder="Confirm table name"
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
