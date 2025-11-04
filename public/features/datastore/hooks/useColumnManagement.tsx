import { useEffect, useState, useMemo, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { TableRow, ColumnSchema } from "../types";
import { AddColumnDropdown } from "../components/AddColumnDropdown";
import { useDatastoreDialogs } from "@public/features/datastore/hooks/useDatastoreDialogs";
import type { SqliteDataType } from "../constants";
import { Checkbox } from "@public/components/ui/checkbox";

export type TableSchema = {
  columns?: Record<string, ColumnSchema>;
};

export function useColumnManagement(
  tableSchema: TableSchema,
  datastoreId: string,
  tableName: string
) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const { openDialog } = useDatastoreDialogs();

  // Handler for when user selects a data type from dropdown
  const handleSelectDataType = useCallback((dataType: SqliteDataType) => {
    openDialog("addColumn", {
      datastoreId,
      tableName,
      dataType,
    });
  }, [openDialog, datastoreId, tableName]);

  // Generate columns from schema_json
  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
    if (!tableSchema) return [];

    const schemacolumns = tableSchema?.columns || {};

    // Sort columns by order
    const sortedcolumns = Object.entries(schemacolumns).sort(
      ([, a], [, b]) => a.order - b.order
    );

    // Create column definitions from columns
    const fieldColumns: ColumnDef<TableRow>[] = sortedcolumns.map(
      ([, field], index) => {
        // First column gets checkbox + value with special header
        if (index === 0) {
          return {
            accessorKey: field.name,
            id: field.name,
            size: 150,
            enableResizing: false, // Disable resizing for first column
            meta: {
              dataType: field.db_type,
              isFirstColumn: true, // Mark as first column for special handling
            },
            header: ({ table }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all rows"
                />
                <span>{field.name}</span>
              </div>
            ),
            // Cell content will be handled by DataTableCell with custom rendering
          };
        }

        // Other columns remain normal
        return {
          accessorKey: field.name,
          header: field.name,
          id: field.name,
          size: 150,
          enableResizing: true,
          meta: {
            dataType: field.db_type,
          },
        };
      }
    );

    // Add the "+" column for creating new columns
    const addColumnDef: ColumnDef<TableRow> = {
      id: "add-column",
      meta: {
        headerClassName: "!p-0 !h-auto",
      },
      size: 150,
      enableResizing: false, // Disable resizing for add-column
      header: () => <AddColumnDropdown onSelectType={handleSelectDataType} />,
      cell: () => null,
    };

    return [...fieldColumns, addColumnDef];
  }, [tableSchema, handleSelectDataType]);

  // Initialize column order when columns change
  useEffect(() => {
    if (columns.length > 0) {
      setColumnOrder(columns.map((c) => c.id as string));
    }
  }, [columns]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);

        // Prevent moving to/from first or last position
        if (newIndex === 0 || newIndex === columnOrder.length - 1) {
          return columnOrder;
        }
        if (oldIndex === 0 || oldIndex === columnOrder.length - 1) {
          return columnOrder;
        }

        return arrayMove(columnOrder, oldIndex, newIndex);
      });
    }
  };

  return {
    columns,
    columnOrder,
    setColumnOrder,
    sensors,
    handleDragEnd,
  };
}
