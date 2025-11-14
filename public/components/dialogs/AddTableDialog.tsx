import apis from "@public/api-calls";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface AddTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tableName: string) => void;
  datastoreId: string;
}

export function AddTableDialog({
  open,
  onOpenChange,
  onConfirm,
  datastoreId,
}: AddTableDialogProps) {
  const [tableName, setTableName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (tableName.trim() && !isLoading) {
      setIsLoading(true);
      try {
        const [data, error] = await apis["/api/v1/datastore/:id/schema"].PATCH({id: datastoreId},{
          type: "add-table",
          table: tableName.trim(),
        });

        if (error) {
          toast.error("Failed to add table", {
            description: error,
          });
          return;
        }

        toast.success("Table added successfully", {
          description: `Table "${tableName.trim()}" has been created`,
        });

        onConfirm(tableName.trim());
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
