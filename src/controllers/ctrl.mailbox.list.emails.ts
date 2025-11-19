import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { MailboxEmail } from "@server/db.d";
import type { TMailboxEmail } from "@server/dto/TMailboxEmail";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import type { Selectable } from "kysely";

export type TPortal = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TArgs = {
  mailboxEmail: string;
  limit: number;
  offset: number;
};

export type TListMailboxEmailsResult = {
  emails: TMailboxEmail[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export async function listMailboxEmailsController(portal: TPortal, args: TArgs): Promise<TErrTuple<TListMailboxEmailsResult>> {
  try {
    // Get all mailboxes for the user's active organization
    const mailbox = await portal.db
      .selectFrom('mailbox')
      .innerJoin('external_mailbox_oauth', 'mailbox.external_mailbox_oauth_id', 'external_mailbox_oauth.id')
      .where('external_mailbox_oauth.organization_id', '=', portal.session.activeOrganizationId!)
      .selectAll()
      .executeTakeFirst();
    if (!mailbox) {
      return [null, createError(ErrorCode.CONTROLLER_MAILBOX_NOT_FOUND)
        .internal(`Mailbox not found for email ${args.mailboxEmail}`)
        .external({ en: `Mailbox not found for email ${args.mailboxEmail}`, de: `Mailbox nicht gefunden für Email ${args.mailboxEmail}` })
        .statusCode(404)
        .buildEntry()];
    }

    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;

    // Get total count
    const totalResult = await portal.db
      .selectFrom('mailbox_email')
      .where('mailbox_email', '=', args.mailboxEmail)
      .select(({ fn }) => [fn.count<number>('id').as('count')])
      .executeTakeFirst();

    const total = totalResult?.count ?? 0;

    // Get paginated emails
    const mailboxEmails = await portal.db
      .selectFrom('mailbox_email')
      .where('mailbox_email', '=', args.mailboxEmail)
      .orderBy('created_date_time', 'desc')
      .limit(limit)
      .offset(offset)
      .selectAll()
      .execute();

    const emails: TMailboxEmail[] = mailboxEmails.map(mailboxEmail => {
      return {
        id: mailboxEmail.id,
        body: mailboxEmail.body ? JSON.parse(mailboxEmail.body) : null,
        bccRecipients: JSON.parse(mailboxEmail.bcc_recipients),
        ccRecipients: JSON.parse(mailboxEmail.cc_recipients),
        toRecipients: JSON.parse(mailboxEmail.to_recipients),
        from: mailboxEmail.from ? JSON.parse(mailboxEmail.from) : null,
        conversationId: mailboxEmail.conversation_id,
        conversationIndex: mailboxEmail.conversation_index,
        createdDateTime: mailboxEmail.created_date_time,
        hasAttachments: mailboxEmail.has_attachments === 1,
        isDraft: mailboxEmail.is_draft === 1,
        mailboxEmail: mailboxEmail.mailbox_email,
        receivedDateTime: mailboxEmail.received_date_time,
        sentDateTime: mailboxEmail.sent_date_time,
        subject: mailboxEmail.subject,
      }
    })

    return [{
      emails,
      pagination: {
        limit,
        offset,
        total
      }
    }, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_MAILBOX_LIST_FAILED)
      .internal(msg)
      .external({ en: 'Failed to retrieve mailboxes', de: 'Fehler beim Abrufen der Mailboxen' })
      .shouldLog(true)
      .statusCode(500)
      .buildEntry();
    return [null, err];
  }
}