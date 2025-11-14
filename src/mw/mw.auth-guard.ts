import type { TSession } from "@server/dto/TSession"
import type { TUser } from "@server/dto/TUser"
import { auth } from "../auth"

export const resolveSession = async (headers: Headers) => {
  let session = await auth.api.getSession({
    headers
  })

  if (!session) return null
  if (session.session.activeOrganizationId === null) {
    const orgs = await auth.api.listOrganizations({ headers })
      .then(orgs => orgs.map(o => ({ ...o, metadata: JSON.parse(o.metadata) })))
    const org = orgs.find(o => o.metadata.type === 'personal')
    if (!org) {
      console.error('No personal organization found')
      return null
    }
    await auth.api.setActiveOrganization({ body: { organizationId: org.id }, headers })
    session = await auth.api.getSession({
      headers
    })
  }

  return {
    user: session!.user as TUser,
    session: session!.session as TSession
  }
}