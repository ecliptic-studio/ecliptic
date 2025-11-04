import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { dropDatastoreController } from "@server/controllers/ctrl.datastore.drop";
import type { TKysely } from "@server/db";
import type { TErrTuple } from "@server/error/error-code.types";
import { tExternal } from "@server/error/t-error";
import { z } from "zod";

type TPortal = {
  server: McpServer,
  ctrl: typeof dropDatastoreController,
  db: TKysely
}

type TArgs = {
  activeOrganizationId: string;
}

export function toolDatastoreDropTx(portal: TPortal, args: TArgs): TErrTuple<RegisteredTool> {

  const tool = portal.server.registerTool('datastore.drop', {
    title: "Drop Datastore",
    description: "Drop a Datastore by name - SQL Database",
    annotations: {
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: false,
    },
    inputSchema: { name: z.string().min(1) },
    outputSchema: {
      deleted: z.boolean()
    }

  }, async ({ name }) => {

    const datastore = await portal.db.selectFrom('datastore')
      .where('organization_id', '=', args.activeOrganizationId)
      .where('internal_name', '=', name)
      .selectAll()
      .executeTakeFirst();

    if (!datastore) {
      return {
        structuredContent: {
          deleted: false
        }
      }
    }

    const [, error] = await portal.ctrl({ db: portal.db, session: { activeOrganizationId: args.activeOrganizationId } }, { id: datastore.id })

    if (error) {
      const errMsg = tExternal('en', error)
      return {
        isError: true,
        content: [
          { type: 'text', text: errMsg }
        ]
      } as any
    }

    return {
      structuredContent: { deleted: true }
    }

  })

  return [tool, null]
}