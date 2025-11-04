import { ContextMenu } from "@base-ui-components/react/context-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDatastoreDialogs } from "@public/features/datastore/hooks/useDatastoreDialogs";
import { cn } from "@public/lib/utils";
import type { Header } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { Copy, Edit, GripVertical, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import type { TableRow } from "../types";
import { getDataTypeIcon, getDataTypeLabel } from "../utils/column-type-icons";
import { getCommonPinningStyles } from "../utils/table-styles";

type DraggableTableHeaderProps = {
  header: Header<TableRow, unknown>;
  canDrag: boolean;
  datastoreId: string;
  tableName: string;
};

export function DraggableTableHeader({ header, canDrag, datastoreId, tableName }: DraggableTableHeaderProps) {
  const { openDialog } = useDatastoreDialogs();
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
      disabled: !canDrag,
    });

  const meta = header.column.columnDef.meta as any;
  const headerClassName = meta?.headerClassName || "";
  const dataType = meta?.dataType;
  const { column } = header;
  const pinningStyles = getCommonPinningStyles(column);
  const isPinned = column.getIsPinned();

  // Get icon for data type
  const DataTypeIcon = dataType ? getDataTypeIcon(dataType) : null;
  const dataTypeLabel = dataType ? getDataTypeLabel(dataType) : null;

  // Context menu handlers
  const handleCopyColumnName = () => {
    navigator.clipboard.writeText(header.column.id);
    toast.success(`Copied column name: ${header.column.id}`);
  };

  const handleRenameColumn = () => {
    openDialog("renameColumn", {
      datastoreId,
      tableName,
      columnName: header.column.id,
    });
  };

  const handleDeleteColumn = () => {
    openDialog("deleteColumn", {
      datastoreId,
      tableName,
      columnName: header.column.id,
    });
  };

  const style: CSSProperties = {
    ...pinningStyles,
    opacity: isDragging ? 0.8 : pinningStyles.opacity,
    position: isPinned ? pinningStyles.position : "relative",
    transform: CSS.Translate.toString(transform),
    transition: "width transform 0.2s ease-in-out",
    zIndex: isDragging ? 10 : pinningStyles.zIndex,
  };

  const headerContent = (
    <div className="flex items-center gap-2">
      {canDrag && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="flex-1 flex items-center gap-2">
        <span className="flex-1">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {DataTypeIcon && (
          <span
            className="text-gray-400 dark:text-gray-500 pr-2"
            title={dataTypeLabel || undefined}
            aria-label={dataTypeLabel || undefined}
          >
            <DataTypeIcon className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 text-left font-medium text-sm",
        headerClassName,
        !canDrag && "px-4"
      )}
    >
      {canDrag ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger>{headerContent}</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner sideOffset={5} className="z-[9999]">
              <ContextMenu.Popup className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[160px]">
                <ContextMenu.Item
                  onClick={handleCopyColumnName}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none"
                >
                  <Copy className="size-4" />
                  Copy column name
                </ContextMenu.Item>
                <ContextMenu.Item
                  onClick={handleRenameColumn}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none"
                >
                  <Edit className="size-4" />
                  Rename column
                </ContextMenu.Item>
                <ContextMenu.Item
                  onClick={handleDeleteColumn}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 outline-none"
                >
                  <Trash2 className="size-4" />
                  Delete column
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ) : (
        headerContent
      )}
      {header.column.getCanResize() && (
        <div
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-400 ${
            header.column.getIsResizing() ? "bg-blue-500 dark:bg-blue-400" : ""
          }`}
        />
      )}
    </th>
  );
}
