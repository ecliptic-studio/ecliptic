import type { TErrorEntry } from "@error/error-code.types";
import { tExternal, tInternal } from "@error/t-error";
import type { TLang } from "@public/i18n/t";
import { kysely } from "@server/db";
import type { BunRequest } from "bun";
import type { TAuth } from "./dto/TAuth";
import { resolveLang } from "./mw/mw.lang";

/**
 * Used in the api layer to translate an controller error to a http json response
 * in the format we want all errors to be returned in
 * Automatically logs the error to the database
 */
export function toErrorResponse({req, auth, lang, error}: {req: BunRequest, auth?: TAuth, lang?: TLang, error: TErrorEntry} ): Response {
  
  if (error.shouldLog)
    kysely.insertInto('log').values({
      level: 'ERROR',
      message: tInternal('en', error),
      error_entry: JSON.stringify(error),
      user_id: auth?.user.id,
      organization_id: auth?.session.activeOrganizationId,
      metadata: JSON.stringify({
        path: req.url,
        method: req.method
      }),
    }).execute().catch(console.error)

  return Response.json({
    type: error.code,
    message: tExternal(lang ?? resolveLang(req.headers), error)
  }, { status: error.statusCode })

}