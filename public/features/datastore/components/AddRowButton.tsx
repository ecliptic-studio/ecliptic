import { Plus } from "lucide-react";

interface AddRowButtonProps {
  onAddRow: () => void;
}

export function AddRowButton({ onAddRow }: AddRowButtonProps) {
  return (
    <tr className="group">
      <td
        onClick={onAddRow}
        className="border-r border-b border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        style={{
          minWidth: "120px",
          height: "40px",
        }}
      >
        <button
          type="button"
          className="w-full h-full flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          aria-label="Add new row"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Row</span>
        </button>
      </td>
      {/* Empty cells for other columns */}
    </tr>
  );
}
