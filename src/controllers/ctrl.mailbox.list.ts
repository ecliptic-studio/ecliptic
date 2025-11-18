import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { TMailbox } from "@server/dto/TMailbox";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";

export type MailboxControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TMailboxListResponse = {
  mailboxes: TMailbox[];
};

/**
 * Controller for getting all mailboxes for the user's active organization
 */
export async function listMailboxesController(
  ctx: MailboxControllerContext
): Promise<TErrTuple<TMailboxListResponse>> {
  try {
    // Get all mailboxes for the user's active organization
    const mailboxes = await ctx.db
      .selectFrom('mailbox')
      .innerJoin('external_mailbox_oauth', 'mailbox.external_mailbox_oauth_id', 'external_mailbox_oauth.id')
      .select(['mailbox.email', 'mailbox.todo_count', 'external_mailbox_oauth.type'])
      .where('external_mailbox_oauth.organization_id', '=', ctx.session.activeOrganizationId!)
      .execute()
      .then(rows => rows.map(row => ({
        email: row.email,
        todoCount: row.todo_count,
        provider: row.type as 'microsoft' | 'google',
      })));

    return [{ mailboxes }, null];
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
