import type { TErrorEntry } from "@error/error-code.types";
import { tExternal, tInternal } from "@error/t-error";
import type { TLang } from "@public/i18n/t";
import { kysely } from "@server/db";
import type { TSession } from "@server/dto/TSession";
import type { TUser } from "@server/dto/TUser";
import type { BunRequest } from "bun";

/**
 * Used in the api layer to translate an controller error to a http json response
 * in the format we want all errors to be returned in
 * Automatically logs the error to the database
 */
export function toErrorResponse({req, user, session, lang, error}: {req: BunRequest, user?: TUser, session?: TSession, lang?: TLang, error: TErrorEntry} ): Response {
  
  if (error.shouldLog)
    kysely.insertInto('log').values({
      level: 'ERROR',
      message: tInternal('en', error),
      error_entry: JSON.stringify(error),
      user_id: user?.id,
      organization_id: session?.activeOrganizationId,
      metadata: JSON.stringify({
        path: req.url,
        method: req.method
      }),
    }).execute().catch(console.error)

  return Response.json({
    type: error.code,
    message: tExternal(lang ?? 'en', error)
  }, { status: error.statusCode })

}