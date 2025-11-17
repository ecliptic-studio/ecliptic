import { kysely } from "@server/db";
import { toErrorResponse } from "@server/server-helper";
import { exchangeCodeForTokenFx } from "@server/subroutines/microsoft/oauth";
import type { BunRequest, Serve, Server } from "bun";

export const authMicrosoft: Serve.Handler<BunRequest<'/auth/microsoft'>, Server<undefined>, Response> = async (req, server) => {

  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const user = await kysely.selectFrom('user').where('id', '=', state!).selectAll().executeTakeFirstOrThrow()
  if(!code) throw new Error('Code is required')

  const [tokenData, error] = await exchangeCodeForTokenFx({fetch}, {code})
  if (error) return toErrorResponse({req, error})
  
  const existingExternalConnection = await kysely.selectFrom('external_connection')
    .where('user_id', '=', user.id)
    .where('type', '=', 'microsoft').selectAll().executeTakeFirst()

  if (existingExternalConnection) {
    // Update the existing external connection
    await kysely.updateTable('external_connection')
      .set({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', existingExternalConnection.id)
      .execute()
  } else {
    // Create a new external connection
    await kysely.insertInto('external_connection')
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        type: 'microsoft',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        subscriptions: JSON.stringify([]),
      })
      .execute()
  }

  console.log(tokenData)


  return Response.redirect(`/`)
}