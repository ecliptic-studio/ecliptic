import { betterAuth } from "better-auth";
import { admin, apiKey, organization } from "better-auth/plugins";
import { nanoid } from "nanoid";
import slug from "slug";

async function createSlug(name: string, suffix = 0) {
  const orgSlug = slug(name + (suffix === 0 ? '' : suffix), { lower: true })
  // TOOD: when slug is taken, this throws
  try {
    await auth.api.checkOrganizationSlug({
      body: {slug: orgSlug}
    });
    return orgSlug
  } catch(err) {
    return createSlug(name, suffix + 1)
  }
}

// Conditionally import database based on runtime
// this is needed because migration script currently only run with nodejs
let database: any;
let kysely: any;
if (typeof Bun !== 'undefined') {
  // Use Bun's database
  const { database: bunDatabase, kysely: bunKysely } = await import("./db");
  database = bunDatabase;
  kysely = bunKysely
} else {
  // Use better-sqlite3 for non-Bun runtimes
  const Database = (await import("better-sqlite3")).default;
  database = new Database('ecliptic.db');
}

export const auth = betterAuth({
  database,
  baseURL: 'http://localhost:3000',
  basePath: '/api/v1/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // disableSignUp: process.env.ENABLE_SIGNUP === 'FALSE',
  },
  databaseHooks: {
    user: {
      create: {
        async after(user, context) {
          const orgSlug = await createSlug(user.name)
          await kysely.transaction().execute(async (trx:any) => {
            const orgId = nanoid()

            await trx.insertInto('organization').values({
              name: user.name,
              slug: orgSlug,
              id: orgId,
              metadata: JSON.stringify({type: 'personal'}),
              createdAt: new Date().toISOString(),
            }).execute()

            await trx.insertInto('member').values({
              id: nanoid(),
              createdAt: new Date().toISOString(),
              organizationId: orgId,
              userId: user.id,
              role: 'owner'
            }).execute()

            await trx.insertInto('permission_target').values({
              organization_id: orgId,
              internal_name: 'global',
              permission_type_id: 'global',
              id: `global`,
              datastore_id: null
            })
            .execute()
            
          }).catch((err: unknown) => {
            console.log('err', err)
            kysely.deleteFrom('account').where('userId', '=', user.id)
            kysely.deleteFrom('user').where('id', '=', user.id)
            // something went wrong.
            throw "Could not create new user"

          })
        },
      }
    }
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      disableSignUp: process.env.ENABLE_SIGNUP === 'FALSE',
      redirectURI: process.env.BASE_URL + '/api/v1/auth/callback/github',
    }
  },
  plugins: [
    apiKey(),
    admin(),
    organization({
      allowUserToCreateOrganization: false,
      membershipLimit: 10000,
      organizationLimit: 100,
      autoCreateOrganizationOnSignUp: false,
      requireEmailVerificationOnInvitation: true,

    })]
})