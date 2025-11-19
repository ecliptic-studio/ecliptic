import { kysely, type TKysely } from "@server/db";
import type { DB, MailboxEmail } from "@server/db.d";
import type { TJob } from "@server/dto/TJob";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createError } from "@server/error/t-error";
import { createGraphClientFx } from "@server/subroutines/microsoft/graph-client.fx";
import { pullMailsFx } from "@server/subroutines/microsoft/pull-mails.fx";
import type { InsertType, Selectable } from "kysely";
import type { InsertExpression } from "node_modules/kysely/dist/esm/parser/insert-values-parser";

type TJobResult = {
  newJobs: TJob[];
  insertedEmails: Selectable<MailboxEmail>[];
}

export async function jobPullEmailsFromMicrosoft(portal: { db: TKysely }, args: {job: TJob<'pull-emails-from-microsoft'>}): Promise<TErrTuple<TJobResult>> {
  const mailbox = await portal.db.selectFrom('mailbox')
  .innerJoin('external_mailbox_oauth', 'mailbox.external_mailbox_oauth_id', 'external_mailbox_oauth.id')
  .where('email', '=', args.job.payload.mailboxEmail)
  .selectAll()
  .executeTakeFirst();

  if(!mailbox) {
    return [null, createError(ErrorCode.JOB_PULL_EMAILS_FROM_MICROSOFT_FAILED)
      .internal('Mailbox not found')
      .external({ en: 'Mailbox not found', de: 'Mailbox nicht gefunden' })
      .statusCode(404)
      .buildEntry()];
  }

  const [graphClient, graphClientError] = await createGraphClientFx({fetch, db: kysely}, {mailboxOauth: mailbox})
  if(graphClientError) {
    return [null, graphClientError];
  }

  const [mails, mailsError] = await pullMailsFx({graphClient}, {mailboxEmail: args.job.payload.mailboxEmail, nextLink: args.job.payload.nextLink})
  if(mailsError) {
    return [null, mailsError];
  }

  let dbInsertValues: InsertExpression<DB, 'mailbox_email'> = mails.messages.map(msg => {

    return {
      id: msg.id,
      external_id: msg.external_id,
      subject: msg.subject,
      body: msg.body ? JSON.stringify(msg.body) : null,
      received_date_time: msg.receivedDateTime,
      sent_date_time: msg.sentDateTime,
      created_date_time: msg.createdDateTime,
      from: msg.from ? JSON.stringify(msg.from) : null,
      bcc_recipients: JSON.stringify(msg.bccRecipients),
      cc_recipients: JSON.stringify(msg.ccRecipients),
      to_recipients: JSON.stringify(msg.toRecipients),
      conversation_index: msg.conversationIndex,
      conversation_id: msg.conversationId,
      has_attachments: msg.hasAttachments ? 1 : 0,
      is_draft: msg.isDraft ? 1 : 0,
      mailbox_email: msg.mailbox_email,
    }
  })

  const insertedEmails = await portal.db.insertInto('mailbox_email')
  .values(dbInsertValues)
  .onConflict(builder => builder.doNothing())
  .returningAll()
  .execute();


  const newJobs: TJob<'pull-emails-from-microsoft'>[] = [{
    ...args.job,
    state: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    locked_by: null,
    locked_at: null,
    attempts: 0,
    max_attempts: 5,
    payload: {
      mailboxEmail: args.job.payload.mailboxEmail,
      nextLink: mails.nextLink
    }
  }]

  return [{
    newJobs,
    insertedEmails,
  }, null];
}