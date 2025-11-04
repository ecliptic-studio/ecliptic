import Elysia from "elysia"
import { auth } from "../auth"
import type { TSession } from "@server/dto/TSession"
import type { TUser } from "@server/dto/TUser"

/**
 * Checks if session maps to user with org
 * Sets personal org if no active organization is set
 */
export const mwAuthGuard = new Elysia()
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        let session = await auth.api.getSession({
          headers
        })

        if (!session) return status(401)
        if (session.session.activeOrganizationId === null) {
          const orgs = await auth.api.listOrganizations({headers})
           .then(orgs => orgs.map(o => ({...o, metadata: JSON.parse(o.metadata)})))
          const org = orgs.find(o => o.metadata.type === 'personal')
          if(!org) return status('Failed Dependency')
          await auth.api.setActiveOrganization({body: {organizationId: org.id}, headers})
          session = await auth.api.getSession({
            headers
          })
        }

        return {
          user: session!.user as TUser,
          session: session!.session as TSession
        }
      }
    }
  })