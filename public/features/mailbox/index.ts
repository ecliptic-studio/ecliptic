/**
 * Mailbox Feature
 *
 * Centralized mailbox management system for email synchronization and processing.
 * Provides components for mailbox setup, email display, and settings management.
 */

export { AddMailboxForm } from "./components/AddMailboxForm";
export { MailboxEmailTable } from "./components/MailboxEmailTable";
export { MailboxSettingsDialog } from "./components/MailboxSettingsDialog";

export type {
  AddMailboxFormData,
  EmailStatus,
  EmailTag,
  EmailWithMockData,
  MailboxEmailTableProps,
  MailboxSettingsDialogProps,
  Provider,
  TableMapping,
  TMailboxEmailRecipient,
} from "./types";

export {
  formatDateTime,
  formatRecipientFull,
  formatRecipientName,
  getProviderLabel,
  getStatusBadgeStyle,
  mockStatus,
  mockTags,
} from "./utils";
