export type TMailboxEmailRecipient = {
  name?: string;
  email: string;
}

export type TMailboxEmail = {
  id: string;
  bccRecipients: TMailboxEmailRecipient[];
  body: { contentType: 'text' | 'html', content: string } | null;
  ccRecipients: TMailboxEmailRecipient[];
  conversationId: string | null;
  conversationIndex: string | null;
  createdDateTime: string | null;
  from: TMailboxEmailRecipient | null;
  hasAttachments: boolean;
  isDraft: boolean;
  mailboxEmail: string;
  receivedDateTime: string | null;
  sentDateTime: string | null;
  subject: string;
  toRecipients: TMailboxEmailRecipient[];
}