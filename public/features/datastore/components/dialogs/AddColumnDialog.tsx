import { ActionDialog } from "@public/components/ActionDialog";
import { Button } from "@public/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@public/components/ui/dropdown-menu";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import rpcClient from "@public/rpc-client";
import { globalStore } from "@public/store/store.global";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { AddColumnMetadata } from "../../types";

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: AddColumnMetadata | null;
}

export function AddColumnDialog({
  open,
  onOpenChange,
  metadata,
}: AddColumnDialogProps) {
  const [columnName, setColumnName] = useState("");
  const [foreignKey, setForeignKey] = useState<{ table: string; column: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);
  const datastores = useStore(globalStore, (state) => state.datastores);

  // Get the current datastore and its tables
  const currentDatastore = datastores.find((ds) => ds.id === metadata?.datastoreId);
  const currentTableName = metadata?.tableName;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setColumnName("");
      setForeignKey(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (columnName.trim() && metadata && !isLoading) {
      setIsLoading(true);
      try {
        const { data, error } = await rpcClient.api.v1.datastore({ id: metadata.datastoreId }).schema.patch({
          type: "add-column",
          table: metadata.tableName,
          column: columnName.trim(),
          db_type: metadata.dataType,
          ...(foreignKey ? { foreign_key: foreignKey } : {}),
        });

        if (error) {
          toast.error("Failed to add column", {
            description: error.value?.message || "An error occurred while adding the column",
          });
          return;
        }

        const fkDescription = foreignKey
          ? ` with foreign key to ${foreignKey.table}.${foreignKey.column}`
          : "";
        toast.success("Column added successfully", {
          description: `Column "${columnName.trim()}" (${metadata.dataType})${fkDescription} has been added to table "${metadata.tableName}"`,
        });

        // Refresh global store to update datastore schemas
        await initialLoading();

        setColumnName("");
        setForeignKey(null);
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to add column", {
          description: "An unexpected error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setColumnName("");
      setForeignKey(null);
    }
    onOpenChange(open);
  };

  const handleSelectForeignKey = (table: string, column: string) => {
    setForeignKey({ table, column });
  };

  const handleRemoveForeignKey = () => {
    setForeignKey(null);
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add New Column"
      description={`Adding a ${metadata?.dataType || ""} column to table "${metadata?.tableName || ""}"`}
      onConfirm={handleConfirm}
      confirmText="Add Column"
      confirmDisabled={!columnName.trim() || isLoading}
    >
      <div className="space-y-4">
        {/* Show selected data type as context */}
        <div className="rounded-md bg-muted p-3 text-sm">
          Data type: <span className="font-mono font-semibold">{metadata?.dataType}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="column-name">Column Name</Label>
          <Input
            id="column-name"
            placeholder="e.g., email, age, created_at"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && columnName.trim()) {
                handleConfirm();
              }
            }}
            autoFocus
          />
        </div>

        {/* Foreign Key Selection */}
        <div className="space-y-2">
          <Label>Foreign Key Reference (Optional)</Label>
          <div className="flex items-center gap-2">
            {foreignKey ? (
              <div className="flex flex-1 items-center justify-between rounded-md border bg-muted px-3 py-2 text-sm">
                <span className="font-mono">
                  {foreignKey.table}.{foreignKey.column}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleRemoveForeignKey}
                  type="button"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline" className="flex-1 justify-between" type="button">
                    <span>Select foreign key...</span>
                    <ChevronDownIcon className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuPositioner>
                  <DropdownMenuContent className="w-[200px]">
                    {currentDatastore &&
                      Object.entries(currentDatastore.schema_json.tables)
                        .filter(([tableName]) => tableName !== currentTableName)
                        .map(([tableName, table]) => (
                          <DropdownMenuSub key={tableName}>
                            <DropdownMenuSubTrigger>
                              <span className="font-mono text-xs">{tableName}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {Object.keys(table.columns).map((columnName) => (
                                <DropdownMenuItem
                                  key={columnName}
                                  onClick={() => handleSelectForeignKey(tableName, columnName)}
                                >
                                  <span className="font-mono text-xs">{columnName}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ))}
                    {(!currentDatastore ||
                      Object.keys(currentDatastore.schema_json.tables).filter(
                        (t) => t !== currentTableName
                      ).length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No other tables available
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenuPositioner>
              </DropdownMenu>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Reference a column from another table to create a foreign key constraint
          </p>
        </div>
      </div>
    </ActionDialog>
  );
}
