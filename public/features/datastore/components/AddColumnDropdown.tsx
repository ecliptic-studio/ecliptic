import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPositioner,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@public/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { SQLITE_DATA_TYPES } from "../constants";
import type { SqliteDataType } from "../constants";

type AddColumnDropdownProps = {
  onSelectType: (dataType: SqliteDataType) => void;
};

export function AddColumnDropdown({ onSelectType }: AddColumnDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full min-h-[40px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer px-4 py-2">
        <Plus className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuPositioner>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Select Data Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SQLITE_DATA_TYPES.map((dataType) => (
              <DropdownMenuItem
                key={dataType}
                onClick={() => onSelectType(dataType)}
              >
                {dataType}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenuPositioner>
    </DropdownMenu>
  );
}
