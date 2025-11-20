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
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import useSWR from "swr";
import { useStore } from "zustand";

export function MailboxDetailPage() {
  const { email } = useParams<{ email: string }>();
  const mailboxes = useStore(globalStore, (state) => state.mailboxes);
  const { setHeaderContent, clearHeader } = useHeader();

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const offset = (currentPage - 1) * 50;
  const { data: emailsData, isLoading: isLoadingEmails } = useSWR(
    email ? `/api/v1/mailbox/${email}?limit=50&offset=${offset}` : null,
    async () => {
      const [result, error] = await api["/api/v1/mailbox/:email"].GET(
        { email: email! },
        { limit: 50, offset }
      );
      if (error) {
        toast.error("Failed to load emails");
        return null;
      }
      return result;
    }
  );

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = emailsData ? Math.ceil(emailsData.pagination.total / emailsData.pagination.limit) : 1;
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const mailbox = mailboxes.find((m) => m.email === email);

  // Transform emails with mock data
  const emails: EmailWithMockData[] = emailsData?.emails.map((apiEmail, index) => ({
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
  })) || [];


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


  return (
    <>
      <MailboxEmailTable
        email={email!}
        emails={emails}
        isLoading={isLoadingEmails}
        pagination={emailsData?.pagination || { limit: 50, offset: 0, total: 0 }}
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
