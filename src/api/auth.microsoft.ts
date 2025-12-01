import { createGraphServiceClient, GraphRequestAdapter } from "@microsoft/msgraph-sdk";
import { kysely } from "@server/db";
import type { TJob } from "@server/dto/TJob";
import { decryptFn } from "@server/subroutines/encryption.fn";
import { checkMailboxAccessFx } from "@server/subroutines/microsoft/check-mailbox-access.fx";
import { exchangeCodeForTokenFx } from "@server/subroutines/microsoft/oauth.fx";
import type { BunRequest, Serve, Server } from "bun";

type TDecryptedState = {
  userId: string;
  email: string;
  timestamp: number;
};

/**
 * Handler for the Microsoft OAuth callback.
 * Public endpoint that is used to authenticate with Microsoft.
 */
export const authMicrosoft: Serve.Handler<BunRequest<'/auth/microsoft'>, Server<undefined>, Response> = async (req, server) => {

  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")

  if(!code) {
    return Response.redirect(`/mailbox?message=${encodeURIComponent('Authorization code is missing')}`)
  }

  if(!state) {
    return Response.redirect(`/mailbox?message=${encodeURIComponent('State parameter is missing')}`)
  }

  // Decrypt state to get userId and email
  let decryptedState: TDecryptedState;
  try {
    decryptedState = decryptFn<TDecryptedState>({
      encryptedData: state,
      key: process.env.BUN_PUBLIC_SECRET!,
    });
  } catch (error: any) {
    console.error('Failed to decrypt state:', error);
    return Response.redirect(`/mailbox?message=${encodeURIComponent('Invalid or expired authorization state')}`)
  }

  // Get user from database
  const user = await kysely
    .selectFrom('user')
    .where('id', '=', decryptedState.userId)
    .selectAll()
    .executeTakeFirst()

  if (!user) {
    return Response.redirect(`/mailbox?message=${encodeURIComponent('User not found')}`)
  }

  const member = await kysely
    .selectFrom('member')
    .where('userId', '=', user.id)
    .selectAll()
    .executeTakeFirst()

  if (!member || !member.organizationId) {
    return Response.redirect(`/mailbox?message=${encodeURIComponent('Organization not found')}`)
  }

  // Exchange code for token
  const [tokenData, tokenError] = await exchangeCodeForTokenFx({fetch}, {code})
  if (tokenError) {
    return Response.redirect(`/mailbox?message=${encodeURIComponent('Failed to authenticate with Microsoft')}`)
  }

  // Create or update external connection
  const existingExternalConnection = await kysely.selectFrom('external_mailbox_oauth')
    .where('organization_id', '=', member.organizationId)
    .where('type', '=', 'microsoft')
    .innerJoin('mailbox', 'external_mailbox_oauth.id', 'mailbox.external_mailbox_oauth_id')
    .where('mailbox.email', '=', decryptedState.email)
    .selectAll()
    .executeTakeFirst()

  let externalConnectionId: string;

  if (existingExternalConnection) {
    // Update the existing external connection
    await kysely.updateTable('external_mailbox_oauth')
      .set({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', existingExternalConnection.id)
      .execute()

    externalConnectionId = existingExternalConnection.id;
  } else {
    // Create a new external connection
    const newConnection = await kysely.insertInto('external_mailbox_oauth')
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: member.organizationId,
        type: 'microsoft',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        subscriptions: JSON.stringify([]),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    externalConnectionId = newConnection.id;
  }

  // Create Graph API client
  const requestAdapter = new GraphRequestAdapter({
    authenticateRequest: async (req) => {
      req.headers.set('Authorization', new Set([`Bearer ${tokenData.access_token}`]));
    },
  });
  const graphClient = createGraphServiceClient(requestAdapter);

  // Check mailbox accessibility
  const [mailboxCheckResult, mailboxError] = await checkMailboxAccessFx(
    { graphClient },
    { email: decryptedState.email }
  );

  if (mailboxError) {
    return Response.redirect(
      `/mailbox?message=${encodeURIComponent(mailboxError.external.en)}`
    );
  }

  // Check if email already exists in external_email table
  const existingEmail = await kysely
    .selectFrom('mailbox')
    .where('external_mailbox_oauth_id', '=', externalConnectionId)
    .where('email', '=', decryptedState.email)
    .selectAll()
    .executeTakeFirst();

  if (!existingEmail) {
    // Add new email to external_email table
    await kysely.insertInto('mailbox')
      .values({
        external_mailbox_oauth_id: externalConnectionId,
        email: decryptedState.email,
      })
      .execute();
  }

  const job: Pick<TJob<'pull-emails-from-microsoft'>, 'type' | 'payload' | 'state'> = {
    payload: {mailboxEmail: decryptedState.email},
    type: 'pull-emails-from-microsoft',
    state: 'pending'
    
  }

  await kysely.insertInto('job').values({
    ...job,
    payload: JSON.stringify(job.payload),
  }).execute();

  return Response.redirect(`/mailbox?message=${encodeURIComponent('Mailbox connected successfully!')}`)
}