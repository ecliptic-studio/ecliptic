import { createContext } from "react";
import type { McpDialogName, OpenDialogFn } from "../types";

interface McpDialogsContextType {
  openDialog: OpenDialogFn;
  closeDialog: (name: McpDialogName) => void;
}

export const McpDialogsContext = createContext<McpDialogsContextType | undefined>(undefined);
