import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { useHeader } from "@public/contexts/HeaderContext";
import { useMcpDialog } from "@public/features/mcp/hooks/use-mcp-dialog";
import { getLangFx } from "@public/i18n/get-lang";
import rpcClient from "@public/rpc-client";
import { Copy, Edit, Eye, EyeOff, Link, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface McpKeyPermission {
  action: {
    id: string;
    i18n_title: string;
    i18n_description: string;
  };
  target: {
    id: string;
    internal_name: string;
    datastore_id: string | null;
    permission_type: {
      id: string;
      i18n_title: string;
      i18n_description: string;
    };
  };
}

interface McpKey {
  id: string;
  internal_name: string;
  permissions: McpKeyPermission[];
}


export function McpSettingsPage() {
  const { setHeaderContent, clearHeader } = useHeader();
  const { openDialog } = useMcpDialog();
  const navigate = useNavigate();
  const lang = getLangFx();
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  // Set header
  useEffect(() => {
    setHeaderContent({
      title: "MCP Settings",
      subtitle: "Manage your MCP API keys and permissions",
      actions: (
        <Button onClick={() => navigate("/mcp-settings/new-api")}>
          <Plus className="size-4 mr-2" />
          Add API Key
        </Button>
      ),
    });

    return () => clearHeader();
  }, [setHeaderContent, clearHeader, navigate]);

  // Fetch keys
  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await rpcClient.api.v1["mcp-keys"].get();

        if (response.error) {
          throw new Error(response.error.value?.message || "Failed to load API keys");
        }

        if (response.data) {
          setKeys(response.data);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load API keys";
        setError(errorMessage);
        toast.error("Error", {
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeys();
  }, []);

  const toggleKeyVisibility = (keyId: string) => {
    setRevealedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (keyId: string, keyName: string) => {
    navigator.clipboard.writeText(keyId);
    toast.success("Copied to clipboard", {
      description: `API key ID for "${keyName}" has been copied`,
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 14) return key;
    const prefix = key.slice(0, 10);
    const suffix = key.slice(-4);
    return `${prefix}${"•".repeat(8)}${suffix}`;
  };

  // Generate a compact permission summary
  const getPermissionSummary = (permissions: McpKeyPermission[]) => {
    if (permissions.length === 0) return "No permissions";

    // Group by permission type
    const byType: Record<string, number> = {};
    permissions.forEach((p) => {
      const typeId = p.target.permission_type.id;
      byType[typeId] = (byType[typeId] || 0) + 1;
    });

    const parts: string[] = [];
    if (byType.global) parts.push(`Global (${byType.global})`);
    if (byType.datastore) parts.push(`Datastore (${byType.datastore})`);
    if (byType["datastore.table"]) parts.push(`Table (${byType["datastore.table"]})`);
    if (byType["datastore.table.column"]) parts.push(`Column (${byType["datastore.table.column"]})`);

    return parts.join(", ") || `${permissions.length} permissions`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage API keys for accessing MCP resources. Each key can have different permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No API keys yet</p>
              <Button onClick={() => navigate("/mcp-settings/new-api")}>
                <Plus className="size-4 mr-2" />
                Create your first API key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key ID</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[200px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.internal_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono">
                          {revealedKeys.has(key.id) ? key.id : maskKey(key.id)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleKeyVisibility(key.id)}
                          title={revealedKeys.has(key.id) ? "Hide key" : "Reveal key"}
                        >
                          {revealedKeys.has(key.id) ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(key.id, key.internal_name)}
                          title="Copy key ID"
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getPermissionSummary(key.permissions)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openDialog("connectMcpKey", {
                              keyId: key.id,
                              keyName: key.internal_name,
                            })
                          }
                        >
                          <Link className="size-4 mr-2" />
                          Connect
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/mcp-settings/edit/${key.id}`)}
                        >
                          <Edit className="size-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            openDialog("deleteMcpKey", {
                              keyId: key.id,
                              keyName: key.internal_name,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
          <CardDescription>Keep your API keys safe and secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>Never share your API keys or commit them to version control</li>
            <li>Use environment variables to store API keys in your applications</li>
            <li>Rotate keys regularly and delete unused keys</li>
            <li>Grant only the minimum required permissions for each key</li>
            <li>Monitor the "Last Used" column to identify inactive keys</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default McpSettingsPage;
