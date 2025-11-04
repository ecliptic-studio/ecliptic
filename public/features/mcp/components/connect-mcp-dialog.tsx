import { Button } from "@public/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@public/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface ConnectMcpDialogProps {
  open: boolean;
  onClose: () => void;
  keyId: string;
  keyName: string;
}

export function ConnectMcpDialog({
  open,
  onClose,
  keyId,
  keyName,
}: ConnectMcpDialogProps) {
  // Get base URL from window location
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const mcpUrl = `${baseUrl}/mcp?key=${keyId}`;

  // Format key name for Claude Code command (remove spaces, lowercase)
  const formattedKeyName = keyName.replace(/\s+/g, "-").toLowerCase();
  const claudeCommand = `claude mcp add --transport http ecliptic-${formattedKeyName} ${mcpUrl}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", {
      description: `${label} has been copied`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[90vh]">
        <DialogTitle>Connect MCP API Key</DialogTitle>
        <DialogDescription>
          Use this API key to connect to MCP-compatible applications
        </DialogDescription>

        <div className="space-y-6 mt-4 overflow-y-auto h-full">
          {/* MCP URL Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">For ChatGPT or Claude Desktop</h3>
            <p className="text-sm text-muted-foreground">
              Add this URL as an MCP server in your application settings:
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm font-mono break-all">
                {mcpUrl}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => copyToClipboard(mcpUrl, "MCP URL")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          {/* Claude Code Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">For Claude Code</h3>
            <p className="text-sm text-muted-foreground">
              Run this command in your terminal:
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm font-mono break-all">
                {claudeCommand}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => copyToClipboard(claudeCommand, "Claude Code command")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Setup Instructions</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>ChatGPT:</strong> Go to Settings → Beta Features → Model Context Protocol
              </li>
              <li>
                <strong>Claude Desktop:</strong> Add the MCP URL to your Claude Desktop configuration
              </li>
              <li>
                <strong>Claude Code:</strong> Run the terminal command above to add the MCP server
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
