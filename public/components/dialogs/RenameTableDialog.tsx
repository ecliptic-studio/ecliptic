import { useState } from "react";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { toast } from "sonner";

interface RenameTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (currentName: string, newName: string) => void;
  currentTableName?: string;
  datastoreId: string;
}

export function RenameTableDialog({
  open,
  onOpenChange,
  onConfirm,
  currentTableName = "",
  datastoreId,
}: RenameTableDialogProps) {
  const [selectedTable, setSelectedTable] = useState(currentTableName);
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (selectedTable.trim() && newName.trim() && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore[datastoreId].schema.patch({
          type: "rename-table",
          table: selectedTable.trim(),
          new_name: newName.trim(),
        });

        if (error) {
          toast.error("Failed to rename table", {
            description: error.value?.message || "An error occurred while renaming the table",
          });
          return;
        }

        toast.success("Table renamed successfully", {
          description: `Table "${selectedTable.trim()}" has been renamed to "${newName.trim()}"`,
        });

        onConfirm(selectedTable.trim(), newName.trim());
        setSelectedTable(currentTableName);
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
      setSelectedTable(currentTableName);
      setNewName("");
    }
    onOpenChange(open);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Rename Table"
      description="Enter the current table name and the new name."
      onConfirm={handleConfirm}
      confirmText="Rename Table"
      confirmDisabled={!selectedTable.trim() || !newName.trim() || isLoading}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-table-name">Current Table Name</Label>
          <Input
            id="current-table-name"
            placeholder="e.g., users"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-table-name">New Table Name</Label>
          <Input
            id="new-table-name"
            placeholder="e.g., customers"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectedTable.trim() && newName.trim()) {
                handleConfirm();
              }
            }}
          />
        </div>
      </div>
    </ActionDialog>
  );
}
