import { ErrorCode } from "@server/error/error-code.enum"
import type { TErrTuple } from "@server/error/error-code.types"
import { createError } from "@server/error/t-error"

type TTokenData = {
  token_type: 'Bearer'
  scope: string
  expires_in: number
  ext_expires_in: number
  access_token: string
  refresh_token: string
}

export async function exchangeCodeForTokenFx(portal: {fetch: typeof fetch}, args: {code: string}): Promise<TErrTuple<TTokenData>> {
  const url = `https://login.microsoftonline.com/${process.env.BUN_PUBLIC_MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
  const params = new URLSearchParams()
  params.append("client_id", process.env.BUN_PUBLIC_MICROSOFT_CLIENT_ID!)
  params.append("scope", "offline_access user.read")
  params.append("code", args.code)
  params.append("redirect_uri", process.env.BUN_PUBLIC_MICROSOFT_CALLBACK_URL!)
  params.append("grant_type", "authorization_code")
  params.append("client_secret", process.env.MICROSOFT_SECRET!)

  const tokenResponse = await portal.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!tokenResponse.ok) {
    return [null, createError(ErrorCode.SR_MICROSOFT_OAUTH_EXCHANGE_CODE_FOR_TOKEN_FAILED).buildEntry()]
  }

  const tokenData: TTokenData = await tokenResponse.json()

  return [tokenData, null]
}


export async function refreshTokenFx(portal: {fetch: typeof fetch}, args: {refresh_token: string}): Promise<TErrTuple<TTokenData>> {
  const url = `https://login.microsoftonline.com/${process.env.BUN_PUBLIC_MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
  const params = new URLSearchParams()
  params.append("client_id", process.env.BUN_PUBLIC_MICROSOFT_CLIENT_ID!)
  params.append("scope", "offline_access user.read")
  params.append("refresh_token", args.refresh_token)
  params.append("grant_type", "refresh_token")
  params.append("client_secret", process.env.MICROSOFT_SECRET!)

  const tokenResponse = await portal.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!tokenResponse.ok) {
    return [null, createError(ErrorCode.SR_MICROSOFT_OAUTH_REFRESH_TOKEN_FAILED).buildEntry()]
  }

  const tokenData: TTokenData = await tokenResponse.json()
  return [tokenData, null]
}