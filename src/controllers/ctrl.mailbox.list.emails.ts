import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { TMailbox } from "@server/dto/TMailbox";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createGraphClientFx } from "@server/subroutines/microsoft/graph-client.fx";

export type MailboxEmailControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TMailboxEmailListResponse = {
};

export async function listMailboxEmailsController(
  ctx: MailboxEmailControllerContext,
  args: { email: string }
): Promise<TErrTuple<TMailboxEmailListResponse>> {
  try {
    // Get all mailboxes for the user's active organization
    const mailbox = await ctx.db
      .selectFrom('mailbox')
      .innerJoin('external_mailbox_oauth', 'mailbox.external_mailbox_oauth_id', 'external_mailbox_oauth.id')
      .where('external_mailbox_oauth.organization_id', '=', ctx.session.activeOrganizationId!)
      .selectAll()
      .executeTakeFirst();
    if (!mailbox) {
      return [null, createError(ErrorCode.CONTROLLER_MAILBOX_NOT_FOUND)
        .internal(`Mailbox not found for email ${args.email}`)
        .external({ en: `Mailbox not found for email ${args.email}`, de: `Mailbox nicht gefunden für Email ${args.email}` })
        .statusCode(404)
        .buildEntry()];
    }

    const [graphClient, graphClientError] = await createGraphClientFx({fetch, db: ctx.db}, {mailboxOauth: mailbox})
    if (graphClientError) {
      return [null, graphClientError];
    }

    const messages = await graphClient.users.byUserId(args.email).mailFolders.byMailFolderId('inbox')
      .messages.delta.get({queryParameters: {
        count: true,
        select: ['id', 'subject'],
        top: 100,

        
      }})

    console.log(JSON.stringify(messages, null, 2), messages?.value?.length)

    return [{ }, null];
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