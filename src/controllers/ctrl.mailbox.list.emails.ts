import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { TMailbox } from "@server/dto/TMailbox";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { jobPullEmailsFromMicrosoft } from "@server/jobs/job.pull-emails-from-microsoft";
import { createGraphClientFx } from "@server/subroutines/microsoft/graph-client.fx";

export type TPortal = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TArgs = {
  mailboxEmail: string;
};

export async function listMailboxEmailsController(portal: TPortal, args: TArgs): Promise<TErrTuple<null>> {
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

    const [jobResult, jobResultError] = await jobPullEmailsFromMicrosoft({db: portal.db}, {job: {
      type: 'pull-emails-from-microsoft',
      payload: {
        mailboxEmail: args.mailboxEmail,
      },
      attempts: 0,
      max_attempts: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      locked_by: null,
      locked_at: null,
      state: 'pending',
      id: 1
    }})


    if(jobResultError) {
      return [null, jobResultError];
    }

    return [null, null];
  } catch (error) {
    console.error(error);
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