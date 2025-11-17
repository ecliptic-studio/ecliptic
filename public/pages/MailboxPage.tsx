import { Button } from "@public/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuTrigger,
} from "@public/components/ui/dropdown-menu";
import { Input } from "@public/components/ui/input";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Provider = "outlook" | "gmail";

export function MailboxPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    inboxAddress: "",
    provider: "outlook" as Provider,
  });
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      // TODO: Implement API call to add mailbox
      // const [data, error] = await apis['/api/v1/mailbox'].POST({
      //   inboxAddress: formData.inboxAddress,
      //   provider: formData.provider
      // });

      // Simulate API call for now
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Mailbox added successfully!", {
        description: `Mailbox "${formData.inboxAddress}" is ready to use.`,
      });
      setFormData({ inboxAddress: "", provider: "outlook" }); // Reset form
      setLoading(false);
    } catch (err) {
      toast.error("An unexpected error occurred", {
        description: "Please try again.",
      });
      setLoading(false);
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
            {loading ? "Adding mailbox..." : "Add Mailbox"}
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
  );
}

export default MailboxPage;
