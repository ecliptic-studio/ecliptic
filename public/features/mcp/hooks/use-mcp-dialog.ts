import { useContext } from "react";
import { McpDialogsContext } from "../context/context.mcp-dialog";

export function useMcpDialog() {
  const context = useContext(McpDialogsContext);
  if (context === undefined) {
    throw new Error("useMcpDialogs must be used within McpDialogsProvider");
  }
  return context;
}
