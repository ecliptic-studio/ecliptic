import { useState } from "react";
import { Button } from "@public/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import type { TableRow } from "../types";
import type { TableSchema } from "../hooks/useColumnManagement";

interface NewRowEditorProps {
  columns: ColumnDef<TableRow>[];
  tableSchema: TableSchema;
  initialData: Record<string, any>;
  onSave: (row: Record<string, any>) => void;
  onCancel: (tempId: string) => void;
}

export function NewRowEditor({
  columns,
  tableSchema,
  initialData,
  onSave,
  onCancel,
}: NewRowEditorProps) {
  const {_tempId, ...rest} = initialData;
  const [localData, setLocalData] = useState(rest);
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (columnName: string, value: any) => {
    setLocalData((prev) => ({ ...prev, [columnName]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      onSave({ ...localData, _tempId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onCancel(_tempId);
  };

  // Filter out the "add-column" column
  const dataColumns = columns.filter((c) => c.id !== "add-column");
  return (
    <tr className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600">
      {dataColumns.map((column, index) => {
        const columnId = column.id as string;
        const isFirstColumn = index === 0;

        if (isFirstColumn) {
          // First column shows action buttons
          return (
            <td
              key={columnId}
              className="border border-gray-300 dark:border-gray-700 text-sm h-[40px] relative px-4 py-2"
              style={{
                minWidth: "120px",
              }}
            >
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </td>
          );
        }

        // Get column data type from schema
        const columnInfo = tableSchema?.columns?.[columnId];
        const dbType = columnInfo?.db_type?.toUpperCase() || "TEXT";

        // Determine input type based on db_type
        let inputType = "text";
        let inputStep: string | undefined = undefined;

        if (dbType === "INTEGER") {
          inputType = "number";
          inputStep = "1";
        } else if (dbType === "REAL") {
          inputType = "number";
          inputStep = "any";
        }

        return (
          <td
            key={columnId}
            className="border border-gray-300 dark:border-gray-700 text-sm h-[40px] relative p-0"
          >
            <input
              type={inputType}
              step={inputStep}
              value={localData[columnId] ?? ""}
              onChange={(e) => handleInputChange(columnId, e.target.value || null)}
              placeholder={`NULL`}
              disabled={isSaving}
              className="bg-blue-50 dark:bg-blue-900/20 w-full h-full px-2 py-1 text-sm border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-inherit"
            />
          </td>
        );
      })}
    </tr>
  );
}
