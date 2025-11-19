import type { GraphServiceClient } from "@microsoft/msgraph-sdk";
import type { DeltaGetResponse } from "@microsoft/msgraph-sdk-users/users/item/mailFolders/item/messages/delta";
import type { Recipient, Event } from "@microsoft/msgraph-sdk/models";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createError } from "@server/error/t-error";

type TArgs = {
  mailboxEmail: string;
  nextLink?: string;
}

type TResult = {
  messages: {
    id: string;
    external_id: string | null;
    subject: string;
    body: { contentType: 'text' | 'html', content: string } | null;
    receivedDateTime: string | null;
    sentDateTime: string | null;
    createdDateTime: string;
    from: { name: string, email: string } | null;
    bccRecipients: { name: string, email: string }[];
    ccRecipients: { name: string, email: string }[];
    toRecipients: { name: string, email: string }[];
    conversationIndex: string | null;
    conversationId: string | null;
    hasAttachments: boolean;
    isDraft: boolean;
    mailbox_email: string;
  }[];
  hasMore: boolean;
  nextLink: string;
}

function parseRecipient(recipients: Recipient | null | undefined): { name: string, email: string } | null {
  if (!recipients?.emailAddress?.name || !recipients?.emailAddress?.address) {
    return null;
  }
  return { name: recipients.emailAddress.name, email: recipients.emailAddress.address };
}

function parseConversationIndex(conversationIndex: ArrayBuffer | null | undefined): string | null {
  if (!conversationIndex) {
    return null;
  }
  return Buffer.from(conversationIndex).toString('hex').toUpperCase();
}

/**
 * Pulls batch of emails, returns next token as link to pull next batch if there are more emails
 */
export async function pullMailsFx(portal: { graphClient: GraphServiceClient }, args: TArgs): Promise<TErrTuple<TResult>> {
  let messages: DeltaGetResponse | undefined;

  if (args.nextLink) {
    messages = await portal.graphClient.users.byUserId(args.mailboxEmail).messages.delta.withUrl(args.nextLink).get()
  } else {
    messages = await portal.graphClient.users.byUserId(args.mailboxEmail).mailFolders.byMailFolderId('inbox')
    .messages.delta.get({
      queryParameters: {
        select: ['id', 'subject', 'body', 'receivedDateTime', 'from', 'bccRecipients', 'ccRecipients', 'toRecipients', 'conversationIndex', 'conversationId', 'hasAttachments', 'createdDateTime', 'sentDateTime', 'isDraft'],
        expand: ['microsoft.graph.eventMessage/event', 'attachments']
      },
    })
  }

  // TODO: remove after testing
  // Bun.file('messages.json').write(JSON.stringify(messages, null, 2))

  if (!messages) {
    return [null, createError(ErrorCode.SR_MICROSOFT_MAILBOX_LIST_FAILED)
      .internal('Failed to retrieve mails')
      .external({ en: 'Failed to retrieve mails', de: 'Fehler beim Abrufen der Mails' })
      .statusCode(500)
      .buildEntry()];
  }

  const hasMore = !!(messages.odataNextLink)
  const nextLink = messages.odataDeltaLink ?? messages.odataNextLink;

  if(!nextLink) {
    return [null, createError(ErrorCode.SR_MICROSOFT_MAILBOX_LIST_FAILED)
      .internal('No next link found')
      .external({ en: 'No next link found', de: 'Kein nächster Link gefunden' })
      .statusCode(500)
      .buildEntry()];
  }

  const parsedMessages = (messages.value ?? []).map(msg => {
    const body = (msg.body?.contentType && msg.body?.content) ? { contentType: msg.body.contentType, content: msg.body.content } : null;
    const from = parseRecipient(msg.from);
    const bccRecipients = msg.bccRecipients?.map(parseRecipient).filter(r => r !== null) ?? [];
    const ccRecipients = msg.ccRecipients?.map(parseRecipient).filter(r => r !== null) ?? [];
    const toRecipients = msg.toRecipients?.map(parseRecipient).filter(r => r !== null) ?? [];
    const conversationIndex = parseConversationIndex(msg.conversationIndex);
    return {
      id: crypto.randomUUID(),
      external_id: msg.id ?? null,
      subject: msg.subject ?? '',
      body,
      receivedDateTime: msg.receivedDateTime?.toISOString() ?? null,
      sentDateTime: msg.sentDateTime?.toISOString() ?? null,
      createdDateTime: msg.createdDateTime?.toISOString() ?? new Date().toISOString(),
      from,
      bccRecipients,
      ccRecipients,
      toRecipients,
      conversationIndex,
      conversationId: msg.conversationId ?? null,
      hasAttachments: msg.hasAttachments ?? false,
      isDraft: msg.isDraft ?? false,
      mailbox_email: args.mailboxEmail,
    }
  })

  const result: TResult = {
    messages: parsedMessages,
    hasMore,
    nextLink,
  }

  return [result, null];
}