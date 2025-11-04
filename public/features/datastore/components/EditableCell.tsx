import { useEffect, useRef } from "react";
import { cn } from "@public/lib/utils";

type EditableCellProps = {
  value: any;
  dataType: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  onValueChange: (value: any) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function EditableCell({
  value,
  dataType,
  onValueChange,
  onSave,
  onCancel,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  // Convert value to string for input
  const stringValue = value === null || value === undefined ? "" : String(value);

  // Handle value change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Type coercion based on data type
    if (newValue === "") {
      // Empty string = NULL
      onValueChange(null);
    } else if (dataType === "INTEGER") {
      const parsed = parseInt(newValue, 10);
      onValueChange(isNaN(parsed) ? newValue : parsed);
    } else if (dataType === "REAL") {
      const parsed = parseFloat(newValue);
      onValueChange(isNaN(parsed) ? newValue : parsed);
    } else {
      // TEXT, BLOB
      onValueChange(newValue);
    }
  };

  // Determine input type based on data type
  const getInputType = () => {
    if (dataType === "INTEGER") return "number";
    if (dataType === "REAL") return "number";
    return "text";
  };

  const getInputStep = () => {
    if (dataType === "INTEGER") return "1";
    if (dataType === "REAL") return "any";
    return undefined;
  };

  return (
    <input
      ref={inputRef}
      type={getInputType()}
      step={getInputStep()}
      value={stringValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full h-full px-2 py-1 text-sm",
        "border-2 border-blue-500 dark:border-blue-400",
        "bg-white dark:bg-gray-800",
        "text-gray-900 dark:text-gray-100",
        "focus:outline-none",
        "font-inherit"
      )}
      placeholder={dataType === "TEXT" || dataType === "BLOB" ? "Enter value..." : "0"}
    />
  );
}
