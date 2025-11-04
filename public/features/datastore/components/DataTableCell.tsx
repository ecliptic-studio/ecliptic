import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@public/components/ui/checkbox";
import { cn } from "@public/lib/utils";
import type { Cell } from "@tanstack/react-table";
import type { CSSProperties } from "react";
import type { TableRow } from "../types";
import { getCommonPinningStyles } from "../utils/table-styles";
import { EditableCell } from "./EditableCell";

type DataTableCellProps = {
  cell: Cell<TableRow, unknown>;
  isSelected: boolean;
  isEditing?: boolean;
  editValue?: any;
  columnDataType?: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  pendingValue?: any;
  hasPendingChange?: boolean;
  onCellClick?: () => void;
  onDoubleClick?: () => void;
  onEditValueChange?: (value: any) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
};

export function DataTableCell({
  cell,
  isSelected,
  isEditing = false,
  editValue,
  columnDataType = "TEXT",
  pendingValue,
  hasPendingChange = false,
  onCellClick,
  onDoubleClick,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
}: DataTableCellProps) {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  });

  const { column, row } = cell;
  const pinningStyles = getCommonPinningStyles(column);
  const cellValue = cell.getValue();

  // Use pending value if it exists, otherwise use cell value
  const displayValue = hasPendingChange ? pendingValue : cellValue;
  const isNull = displayValue === null || displayValue === undefined;

  // Check if this is the first column (has checkbox)
  const isFirstColumn = column.columnDef.meta?.isFirstColumn === true;

  const style: CSSProperties = {
    ...pinningStyles,
    opacity: isDragging ? 0.8 : pinningStyles.opacity,
    transform: CSS.Translate.toString(transform),
    transition: "width transform 0.2s ease-in-out",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    zIndex: isDragging ? 10 : pinningStyles.zIndex,
  };

  const cellContent = (
    <>
      {isSelected && !isEditing && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: "inset 0 0 0 2px rgb(59 130 246)",
          }}
          aria-hidden="true"
        />
      )}

      {hasPendingChange && !isEditing && (
        <div
          className="absolute top-0 right-0 w-0 h-0 pointer-events-none"
          style={{
            borderTop: "8px solid rgb(245 158 11)",
            borderLeft: "8px solid transparent",
          }}
          aria-hidden="true"
          title="Unsaved change"
        />
      )}

      {isEditing ? (
        <EditableCell
          value={editValue}
          dataType={columnDataType}
          onValueChange={onEditValueChange!}
          onSave={onSaveEdit!}
          onCancel={onCancelEdit!}
        />
      ) : isFirstColumn ? (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()} // Prevent cell click from interfering
          />
          <span>{isNull ? <span className="font-mono text-xs">NULL</span> : String(displayValue)}</span>
        </div>
      ) : isNull ? (
        <span className="font-mono text-xs">NULL</span>
      ) : (
        <span>{String(displayValue)}</span>
      )}
    </>
  );

  return (
    <td
      ref={setNodeRef}
      style={style}
      role="gridcell"
      aria-selected={isSelected}
      onClick={onCellClick}
      onDoubleClick={onDoubleClick}
      data-cell-value={isNull ? "" : String(displayValue)}
      data-cell-is-null={String(isNull)}
      className={cn(
        "border border-gray-300 dark:border-gray-700 text-sm h-[40px] relative",
        !isEditing && "px-4 py-2",
        isEditing && "p-0",
        isNull && !isEditing
          ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          : hasPendingChange
            ? "bg-amber-50 dark:bg-amber-950"
            : "bg-white dark:bg-gray-800",
        !isEditing && onCellClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
      )}
    >
      {cellContent}
    </td>
  );
}
