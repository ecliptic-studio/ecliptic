import { useState, type ReactNode } from "react";
import { ConnectMcpDialog } from "../components/connect-mcp-dialog";
import { DeleteMcpKeyDialog } from "../components/delete-mcp-dialog";
import { McpDialogsContext } from "../context/context.mcp-dialog";
import type { McpDialogName, McpDialogRegistry, OpenDialogFn } from "../types";


export function McpDialogsProvider({ children }: { children: ReactNode }) {
  const [openDialogs, setOpenDialogs] = useState<Partial<Record<McpDialogName, boolean>>>({});
  const [dialogMetadata, setDialogMetadata] = useState<Partial<McpDialogRegistry>>({});

  const openDialog: OpenDialogFn = (name, metadata) => {
    setDialogMetadata((prev) => ({ ...prev, [name]: metadata }));
    setOpenDialogs((prev) => ({ ...prev, [name]: true }));
  };

  const closeDialog = (name: McpDialogName) => {
    setOpenDialogs((prev) => ({ ...prev, [name]: false }));
  };

  return (
    <McpDialogsContext.Provider value={{ openDialog, closeDialog }}>
      {children}

      {/* Render all dialogs - they control their own visibility */}

      <DeleteMcpKeyDialog
        open={openDialogs.deleteMcpKey ?? false}
        onOpenChange={(open) => !open && closeDialog("deleteMcpKey")}
        metadata={dialogMetadata.deleteMcpKey ?? null}
      />

      <ConnectMcpDialog
        open={openDialogs.connectMcpKey ?? false}
        onClose={() => closeDialog("connectMcpKey")}
        keyId={dialogMetadata.connectMcpKey?.keyId ?? ""}
        keyName={dialogMetadata.connectMcpKey?.keyName ?? ""}
      />
    </McpDialogsContext.Provider>
  );
}

