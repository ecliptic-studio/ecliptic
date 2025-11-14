import apis from "@public/api-calls";
import { ActionDialog } from "@public/components/ActionDialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DeleteMcpKeyMetadata } from "../types";

interface DeleteMcpKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DeleteMcpKeyMetadata | null;
}

export function DeleteMcpKeyDialog({ open, onOpenChange, metadata }: DeleteMcpKeyDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmText("");
    }
  }, [open]);

  const isValid = confirmText === metadata?.keyName;

  const handleConfirm = async () => {
    if (!isValid || !metadata || isLoading) return;

    setIsLoading(true);
    try {
      const [data, error] = await apis["/api/v1/mcp-keys/:id"].DELETE({id: metadata.keyId})

      if (error) {
        toast.error("Failed to delete API key", {
          description: error
        });
        return;
      }

      toast.success("API key deleted", {
        description: `Key "${metadata.keyName}" has been deleted`,
      });

      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete API key", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete API Key"
      description={`This action cannot be undone. This will permanently delete the API key "${metadata?.keyName}" and revoke all access.`}
      onConfirm={handleConfirm}
      confirmText="Delete Key"
      confirmVariant="destructive"
      confirmDisabled={!isValid || isLoading}
    >
      <div className="space-y-2">
        <Label htmlFor="confirm-input">
          Type <span className="font-mono font-semibold">{metadata?.keyName}</span> to confirm
        </Label>
        <Input
          id="confirm-input"
          placeholder={metadata?.keyName}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={isLoading}
        />
      </div>
    </ActionDialog>
  );
}
