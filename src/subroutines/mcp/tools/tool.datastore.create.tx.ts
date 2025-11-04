import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createDatastoreController } from "@server/controllers/ctrl.datastore.create";
import type { TKysely } from "@server/db";
import type { TErrTuple } from "@server/error/error-code.types";
import { tExternal } from "@server/error/t-error";
import { z } from "zod";

type TPortal = {
  server: McpServer,
  ctrl: typeof createDatastoreController,
  db: TKysely
}

type TArgs = {
  activeOrganizationId: string;
}

export function toolDatastoreCreateTx(portal: TPortal, args: TArgs): TErrTuple<RegisteredTool> {

  const tool = portal.server.registerTool('datastore.create', {
    title: "Create Datastore",
    description: "Create a new Datastore - SQL Database",
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
      readOnlyHint: false,
    },
    inputSchema: { name: z.string().min(1) },
    outputSchema: {
      result: z.object({
        id: z.string().nanoid(),
        internal_name: z.string(),
        status: z.string(),
        provider: z.string(),
        schema_json: z.object({
          tables: z.record(
            z.string(),
            z.object({
              columns: z.record(
                z.string(),
                z.object({
                  name: z.string(),
                  order: z.number(),
                  db_type: z.enum(['TEXT', 'INTEGER', 'REAL', 'BLOB'])
                })
              )

            }))
        })
      })
    }

  }, async ({ name }) => {
    const [datastore, error] = await portal.ctrl({ db: portal.db, session: { activeOrganizationId: args.activeOrganizationId } }, { internalName: name, provider: 'sqlite' })

    if (error) {
      const errMsg = tExternal('en', error)
      return {
        isError: true,
        content: [
          { type: 'text', text: errMsg }
        ]
      } as any

    }

    const { id, internal_name, status, provider, schema_json } = datastore;

    return {
      // content: [{ text: `Datastore ${name} created successfully` }],
      structuredContent: { result: { id, internal_name, status, provider, schema_json } }
    }

  })

  return [tool, null]
}