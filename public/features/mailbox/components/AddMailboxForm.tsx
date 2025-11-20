/**
 * Add Mailbox Form Component
 *
 * Form for adding a new mailbox with OAuth provider selection
 */

import { Button } from "@public/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@public/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
} from "@public/components/ui/dropdown-menu";
import { Input } from "@public/components/ui/input";
import { betterAuthClient } from "@public/lib/auth-client";
import { encryptFnBrowser } from "@public/lib/encryption-browser";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AddMailboxFormData, Provider } from "../types";
import { getProviderLabel } from "../utils";

async function createEncryptedState(userId: string, email: string): Promise<string> {
  const payload = {
    userId,
    email,
    timestamp: Date.now(),
  };

  const key = process.env.BUN_PUBLIC_SECRET!;
  const iv = crypto.getRandomValues(new Uint8Array(12));

  return encryptFnBrowser({ data: payload, key, iv });
}

function getMicrosoftAuthorizeUrl(encryptedState: string) {
  const tenant = process.env.BUN_PUBLIC_MICROSOFT_TENANT_ID as string;
  const clientId = process.env.BUN_PUBLIC_MICROSOFT_CLIENT_ID as string;
  const redirectUri = process.env.BUN_PUBLIC_MICROSOFT_CALLBACK_URL as string;
  const responseType = "code";
  const responseMode = "query";
  const scope = ["offline_access", "user.read", "Mail.ReadWrite", "Mail.Send"];

  const authorizeUrlParams = new URLSearchParams({
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    response_mode: responseMode,
    scope: scope.join(" "),
    state: encryptedState,
    prompt: "consent",
  });

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${authorizeUrlParams.toString()}`;
  return url;
}

export function AddMailboxForm() {
  const [formData, setFormData] = useState<AddMailboxFormData>({
    inboxAddress: "",
    provider: "outlook",
  });
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProviderChange = (provider: Provider) => {
    setFormData((prev) => ({
      ...prev,
      provider,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowDialog(true);
  };

  const handleContinueToMicrosoft = async () => {
    setLoading(true);

    try {
      const session = await betterAuthClient.getSession();

      if (!session?.data?.user?.id) {
        toast.error("Authentication required", {
          description: "Please sign in to continue.",
        });
        setLoading(false);
        return;
      }

      const encryptedState = await createEncryptedState(
        session.data.user.id,
        formData.inboxAddress
      );

      const authUrl = getMicrosoftAuthorizeUrl(encryptedState);
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred", {
        description: "Please try again.",
      });
      setLoading(false);
      setShowDialog(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Add New Mailbox</h1>
          <p className="text-sm text-muted-foreground">
            Connect your email inbox to sync and manage messages
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="inboxAddress" className="text-sm font-medium">
              Inbox Address
            </label>
            <Input
              id="inboxAddress"
              name="inboxAddress"
              type="email"
              placeholder="you@example.com"
              value={formData.inboxAddress}
              onChange={handleChange}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter the email address you want to connect
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-full"
                disabled={loading}
                render={
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span>{getProviderLabel(formData.provider)}</span>
                    <ChevronDown className="size-4" />
                  </button>
                }
              />
              <DropdownMenuPositioner>
                <DropdownMenuContent className="w-full min-w-[var(--anchor-width)]">
                  <DropdownMenuItem onClick={() => handleProviderChange("outlook")}>
                    Outlook
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleProviderChange("gmail")}
                    disabled
                    className="opacity-50"
                  >
                    Gmail (Not supported yet)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPositioner>
            </DropdownMenu>
            <p className="text-xs text-muted-foreground">Select your email provider</p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || formData.provider === "gmail"}
          >
            Add Mailbox
          </Button>
        </form>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Microsoft Account Authorization</DialogTitle>
            <DialogDescription>
              You will be redirected to Microsoft to authorize access to your mailbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Please select a Microsoft account that has <strong>read/write access</strong> to
              the inbox address you provided: <strong>{formData.inboxAddress}</strong>
            </p>
            <p>
              <strong>Note:</strong> Shared mailboxes are supported. Make sure the account you
              select has the necessary permissions.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleContinueToMicrosoft} disabled={loading}>
              {loading ? "Redirecting..." : "Continue to Microsoft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
