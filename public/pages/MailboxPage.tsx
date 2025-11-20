import apis from "@public/api-calls";
import { AddMailboxForm } from "@public/features/mailbox";
import { globalStore } from "@public/store/store.global";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export function MailboxPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const loadMailboxes = async () => {
      const [mailboxes, error] = await apis["/api/v1/mailbox"].GET();
      if (error !== null) {
        toast.error(error);
      } else {
        globalStore.setState({ mailboxes: mailboxes.mailboxes });
      }
    };
    loadMailboxes();
  }, []);

  // Check for message in URL params and display it
  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      // Determine if it's success or error based on message content
      const isSuccess = message.toLowerCase().includes("success");

      if (isSuccess) {
        toast.success(message);
      } else {
        toast.error(message);
      }

      // Remove message param from URL
      searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="p-8 min-h-full flex justify-center">
      <div className="w-full max-w-md space-y-6">
        <AddMailboxForm />

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
