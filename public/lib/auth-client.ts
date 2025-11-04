import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"

export const betterAuthClient = createAuthClient({
  baseURL: 'http://localhost:3000',
  basePath: '/api/v1/auth',
  plugins: [organizationClient()]
})