import apis from "@public/api-calls";
import { Button } from "@public/components/ui/button";
import { useHeader } from "@public/contexts/HeaderContext";
import { EditMcpForm } from "@public/features/mcp/components/edit-mcp-form";
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
    apis["/api/v1/permission/targets-and-actions"].GET
  );

  // Fetch existing MCP key data if in edit mode
  const { data: keysResponse, error: keysError, isLoading: isKeysLoading } = useSWR(
    isEditMode ? '/mcp-keys' : null,
    apis["/api/v1/mcp-keys"].GET
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
  if (metadataError || metadataResponse?.[1]) {
    return <div className="p-6 max-w-6xl mx-auto text-destructive">
      Error loading metadata: {metadataError?.message || metadataResponse?.[1]}
    </div>;
  }

  if (isEditMode && (keysError || keysResponse?.[1])) {
    return <div className="p-6 max-w-6xl mx-auto text-destructive">
      Error loading API key: {keysError?.message || keysResponse?.[1]}
    </div>;
  }

  if (!metadataResponse?.[0]) {
    return <div className="p-6 max-w-6xl mx-auto">No metadata available</div>;
  }

  // Find the specific key if in edit mode
  let existingKey = null;
  if (isEditMode && keysResponse?.[0]) {
    existingKey = keysResponse[0].find((key: any) => key.id === keyId);
    if (!existingKey) {
      return <div className="p-6 max-w-6xl mx-auto text-destructive">
        API key not found
      </div>;
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <EditMcpForm
        actions={metadataResponse[0].actions}
        targets={metadataResponse[0].targets}
        allowedActionsByType={metadataResponse[0].allowedActionsByType}
        existingKey={existingKey}
        isEditMode={isEditMode}
      />
    </div>
  );
}

export default McpApiKeyEditorPage;
