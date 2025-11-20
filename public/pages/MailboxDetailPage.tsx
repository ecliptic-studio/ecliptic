import api from "@public/api-calls";
import { Button } from "@public/components/ui/button";
import { useHeader } from "@public/contexts/HeaderContext";
import {
  MailboxEmailTable,
  MailboxSettingsDialog,
  mockStatus,
  mockTags,
  type EmailWithMockData,
} from "@public/features/mailbox";
import { globalStore } from "@public/store/store.global";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "zustand";

export function MailboxDetailPage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const mailboxes = useStore(globalStore, (state) => state.mailboxes);
  const { setHeaderContent, clearHeader } = useHeader();

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [emails, setEmails] = useState<EmailWithMockData[]>([]);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const mailbox = mailboxes.find((m) => m.email === email);

  useEffect(() => {
    if (!mailbox) {
      toast.error("Mailbox not found");
      navigate("/mailbox");
    }
  }, [mailbox, navigate]);

  // Set header content
  useEffect(() => {
    if (mailbox) {
      setHeaderContent({
        title: `${email}`,
        subtitle: `${mailbox.todoCount} emails pending`,
        actions: (
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            SETTINGS
          </Button>
        ),
      });
    }

    return () => clearHeader();
  }, [email, mailbox, setHeaderContent, clearHeader]);

  if (!mailbox) {
    return null; // Will redirect via useEffect
  }

  // Load emails when page changes
  useEffect(() => {
    const loadEmails = async () => {
      if (!email) return;

      setIsLoadingEmails(true);
      const offset = (currentPage - 1) * 50;
      const [result, error] = await api["/api/v1/mailbox/:email"].GET(
        { email },
        { limit: 50, offset }
      );

      if (error) {
        toast.error("Failed to load emails");
        setIsLoadingEmails(false);
        return;
      }

      if (result) {
        // Transform API emails to include mock status and tags
        const emailsWithMockData: EmailWithMockData[] = result.emails.map((apiEmail, index) => ({
          id: apiEmail.id,
          status: mockStatus(index),
          tags: mockTags(index),
          subject: apiEmail.subject,
          createdDateTime: apiEmail.createdDateTime,
          from: apiEmail.from,
          toRecipients: apiEmail.toRecipients,
          ccRecipients: apiEmail.ccRecipients,
          bccRecipients: apiEmail.bccRecipients,
          body: apiEmail.body,
          hasAttachments: apiEmail.hasAttachments,
        }));

        setEmails(emailsWithMockData);
        setPagination(result.pagination);
      }

      setIsLoadingEmails(false);
    };

    loadEmails();
  }, [email, currentPage]);

  return (
    <>
      <MailboxEmailTable
        email={email!}
        emails={emails}
        isLoading={isLoadingEmails}
        pagination={pagination}
        currentPage={currentPage}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
      />

      <MailboxSettingsDialog
        email={email!}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </>
  );
}

export default MailboxDetailPage;
