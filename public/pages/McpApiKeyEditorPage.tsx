import { Button } from "@public/components/ui/button";
import { useHeader } from "@public/contexts/HeaderContext";
import { EditMcpForm } from "@public/features/mcp/components/edit-mcp-form";
import rpcClient from "@public/rpc-client";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";

export function McpApiKeyEditorPage() {
  const { keyId } = useParams<{ keyId?: string }>();
  const navigate = useNavigate();
  const { setHeaderContent, clearHeader } = useHeader();

  const isEditMode = !!keyId;

  // Fetch permission metadata (targets and actions)
  const { data: metadataResponse, error: metadataError, isLoading: isMetadataLoading } = useSWR(
    '/permission-metadata',
    rpcClient.api.v1.permission["targets-and-actions"].get
  );

  // Fetch existing MCP key data if in edit mode
  const { data: keysResponse, error: keysError, isLoading: isKeysLoading } = useSWR(
    isEditMode ? '/mcp-keys' : null,
    rpcClient.api.v1["mcp-keys"].get
  );

  // Set header
  useEffect(() => {
    setHeaderContent({
      title: isEditMode ? "Edit API Key" : "Create API Key",
      subtitle: isEditMode
        ? "Modify permissions for this API key"
        : "Create a new API key with custom permissions",
      actions: (
        <Button variant="outline" onClick={() => navigate("/mcp-settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to MCP Settings
        </Button>
      )
    });

    return () => clearHeader();
  }, [setHeaderContent, clearHeader, isEditMode, navigate]);

  // Loading states
  const isLoading = isMetadataLoading || (isEditMode && isKeysLoading);

  if (isLoading) return <div className="p-6 max-w-6xl mx-auto">Loading...</div>;

  // Error handling
  if (metadataError || metadataResponse?.error) {
    return <div className="p-6 max-w-6xl mx-auto text-destructive">
      Error loading metadata: {metadataError?.message || 'Unknown error'}
    </div>;
  }

  if (isEditMode && (keysError || keysResponse?.error)) {
    return <div className="p-6 max-w-6xl mx-auto text-destructive">
      Error loading API key: {keysError?.message || 'Unknown error'}
    </div>;
  }

  if (!metadataResponse?.data) {
    return <div className="p-6 max-w-6xl mx-auto">No metadata available</div>;
  }

  // Find the specific key if in edit mode
  let existingKey = null;
  if (isEditMode && keysResponse?.data) {
    existingKey = keysResponse.data.find((key: any) => key.id === keyId);
    if (!existingKey) {
      return <div className="p-6 max-w-6xl mx-auto text-destructive">
        API key not found
      </div>;
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <EditMcpForm
        actions={metadataResponse.data.actions}
        targets={metadataResponse.data.targets}
        allowedActionsByType={metadataResponse.data.allowedActionsByType}
        existingKey={existingKey}
        isEditMode={isEditMode}
      />
    </div>
  );
}

export default McpApiKeyEditorPage;
