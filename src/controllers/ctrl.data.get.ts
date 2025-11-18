import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { TMailbox } from "@server/dto/TMailbox";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";

export type DataControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TDataResponse = {
  datastores: TDatastore[];
  mailboxes: TMailbox[];
};

/**
 * Controller for getting all data slices (currently only datastores)
 * for the user's active organization
 */
export async function getDataController(
  ctx: DataControllerContext
): Promise<TErrTuple<TDataResponse>> {
  try {
    // Get all datastores for the user's active organization
    const datastores = await ctx.db
      .selectFrom('datastore')
      .selectAll()
      .where('organization_id', '=', ctx.session.activeOrganizationId!)
      .execute();

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

    // Transform to DTOs
    const datastoreDtos = datastores.map(toTDatastore);

    return [{ datastores: datastoreDtos, mailboxes }, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATA_GET_FAILED)
      .internal(msg)
      .external({ en: 'Failed to retrieve data', de: 'Fehler beim Abrufen der Daten' })
      .shouldLog(true)
      .statusCode(500)
      .buildEntry();
    return [null, err];
  }
}
