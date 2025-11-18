import { createGraphServiceClient, GraphRequestAdapter, type GraphServiceClient } from "@microsoft/msgraph-sdk";
import type { ExternalMailboxOauth } from "@server/db.d";
import type { TKysely } from "@server/db";
import type { TErrTuple } from "@server/error/error-code.types";
import { refreshTokenFx } from "./oauth.fx";

/**
 * This is an effectful function (.fx) that creates a Graph API client
 * It refreshes the token if it is expired and updates the database
 */
export async function createGraphClientFx(portal: {fetch: typeof fetch, db: TKysely}, args: {mailboxOauth: ExternalMailboxOauth}): Promise<TErrTuple<GraphServiceClient>> {
  if (args.mailboxOauth.expires_at < new Date().toISOString()) {
    const [tokenData, tokenError] = await refreshTokenFx({fetch}, {refresh_token: args.mailboxOauth.refresh_token})
    if (tokenError) return [null, tokenError]
    args.mailboxOauth.access_token = tokenData.access_token
    args.mailboxOauth.expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    await portal.db.updateTable('external_mailbox_oauth').set({
      access_token: tokenData.access_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
    }).where('id', '=', args.mailboxOauth.id).returningAll().executeTakeFirstOrThrow()
  }

    // Create Graph API client
    const requestAdapter = new GraphRequestAdapter({
      authenticateRequest: async (req) => {
        req.headers.set('Authorization', new Set([`Bearer ${args.mailboxOauth.access_token}`]));
      },
    });
    const graphClient = createGraphServiceClient(requestAdapter);

    return [graphClient, null]
}