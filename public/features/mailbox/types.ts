/**
 * Mailbox Feature Types
 *
 * Type definitions for mailbox management and email handling
 */

export type Provider = "outlook" | "gmail";

export type EmailStatus = "PENDING" | "TODO" | "DONE" | "DISCARDED";

export interface TMailboxEmailRecipient {
  name?: string;
  email: string;
}

export interface EmailWithMockData {
  id: string;
  status: EmailStatus;
  tags: string[];
  subject: string;
  createdDateTime: string | null;
  from: TMailboxEmailRecipient | null;
  toRecipients: TMailboxEmailRecipient[];
  ccRecipients: TMailboxEmailRecipient[];
  bccRecipients: TMailboxEmailRecipient[];
  body: { contentType: "text" | "html"; content: string } | null;
  hasAttachments: boolean;
}

export interface EmailTag {
  id: string;
  name: string;
  description: string;
}

export interface TableMapping {
  id: string;
  datastoreId: string;
  tableName: string;
  description: string;
}

export interface MailboxEmailTableProps {
  email: string;
  emails: EmailWithMockData[];
  isLoading: boolean;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  currentPage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export interface MailboxSettingsDialogProps {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface AddMailboxFormData {
  inboxAddress: string;
  provider: Provider;
}
