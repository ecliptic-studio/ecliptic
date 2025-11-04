// MCP Dialog Metadata Definitions

export interface AddMcpKeyMetadata {
  // No initial data needed for adding new key
}

export interface DeleteMcpKeyMetadata {
  keyId: string;
  keyName: string;
}

export interface ConnectMcpKeyMetadata {
  keyId: string;
  keyName: string;
}

// Dialog Registry - single source of truth for type safety
export interface McpDialogRegistry {
  addMcpKey: AddMcpKeyMetadata;
  deleteMcpKey: DeleteMcpKeyMetadata;
  connectMcpKey: ConnectMcpKeyMetadata;
}

// Type helpers extracted from registry
export type McpDialogName = keyof McpDialogRegistry;

export type OpenDialogFn = <K extends McpDialogName>(
  name: K,
  metadata: McpDialogRegistry[K]
) => void;
