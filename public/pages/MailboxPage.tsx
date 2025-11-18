import apis from "@public/api-calls";
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
import { globalStore } from "@public/store/store.global";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "zustand";

type Provider = "outlook" | "gmail";

async function createEncryptedState(userId: string, email: string): Promise<string> {
  const payload = {
    userId,
    email,
    timestamp: Date.now(),
  };

  // Get encryption key from environment
  const key = process.env.BUN_PUBLIC_SECRET!;

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  return encryptFnBrowser({data: payload, key, iv});
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

export function MailboxPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const a = useStore(globalStore)
  const [formData, setFormData] = useState({
    inboxAddress: "",
    provider: "outlook" as Provider,
  });
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const loadMailboxes = async () => {
      const [mailboxes, error] = await apis["/api/v1/mailbox"].GET();
      if (error !== null) {
        toast.error(error);
      } else {
        globalStore.setState({ mailboxes: mailboxes.mailboxes })
      }
    };
    loadMailboxes();
  }, []);

  // Check for message in URL params and display it
  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      // Determine if it's success or error based on message content
      const isSuccess = message.toLowerCase().includes('success');

      if (isSuccess) {
        toast.success(message);
      } else {
        toast.error(message);
      }

      // Remove message param from URL
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      // Get the current user session
      const session = await betterAuthClient.getSession();

      if (!session?.data?.user?.id) {
        toast.error("Authentication required", {
          description: "Please sign in to continue.",
        });
        setLoading(false);
        return;
      }

      // Create encrypted state with userId and email
      const encryptedState = await createEncryptedState(
        session.data.user.id,
        formData.inboxAddress
      );

      // Get Microsoft OAuth URL
      const authUrl = getMicrosoftAuthorizeUrl(encryptedState);

      // Redirect to Microsoft OAuth
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

  const getProviderLabel = (provider: Provider) => {
    switch (provider) {
      case "outlook":
        return "Outlook";
      case "gmail":
        return "Gmail (Not supported yet)";
      default:
        return provider;
    }
  };

  return (
    <>
      <div className="p-8 min-h-full flex justify-center">
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
            <p className="text-xs text-muted-foreground">
              Select your email provider
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || formData.provider === "gmail"}
          >
            Add Mailbox
          </Button>
        </form>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-primary underline-offset-4 hover:underline"
          >
            Back to Home
          </button>
        </div>
      </div>
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
            Please select a Microsoft account that has <strong>read/write access</strong> to the inbox address you provided: <strong>{formData.inboxAddress}</strong>
          </p>
          <p>
            <strong>Note:</strong> Shared mailboxes are supported. Make sure the account you select has the necessary permissions.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDialog(false)}
            disabled={loading}
          >
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

export default MailboxPage;
