import type { TErrorEntry } from "@error/error-code.types";
import { tExternal, tInternal } from "@error/t-error";
import { kysely } from "@server/db";
import { type Context } from 'elysia';
import type { TUser } from "@server/dto/TUser";
import type { TSession } from "@server/dto/TSession";
import type { TLang } from "@public/i18n/t";

/**
 * Used in the api layer to translate an controller error to a http json response
 * in the format we want all errors to be returned in
 */
export function jsonError(ctx: Context & { user?: TUser, session?: TSession, lang?: TLang}, err: TErrorEntry) {
  
  if (err.shouldLog)
    kysely.insertInto('log').values({
      level: 'ERROR',
      message: tInternal('en', err),
      error_entry: JSON.stringify(err),
      user_id: ctx.user?.id,
      organization_id: ctx.session?.activeOrganizationId,
      metadata: JSON.stringify({
        path: ctx.path,
        route: ctx.route,
        method: ctx.request.method
      })
    }).execute().catch(console.error)

  return {
    type: err.code, // named type to merge with elysia error validator
    message: tExternal(ctx.lang ?? 'en', err)
  }

}