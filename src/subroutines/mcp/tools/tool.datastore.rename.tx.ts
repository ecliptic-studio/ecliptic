import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { renameDatastoreController } from "@server/controllers/ctrl.datastore.rename";
import type { TKysely } from "@server/db";
import type { TErrTuple } from "@server/error/error-code.types";
import { tExternal } from "@server/error/t-error";
import { z } from "zod";

type TPortal = {
  server: McpServer;
  ctrl: typeof renameDatastoreController;
  db: TKysely;
};

type TArgs = {
  activeOrganizationId: string;
};

export function toolDatastoreRenameTx(
  portal: TPortal,
  args: TArgs
): TErrTuple<RegisteredTool> {
  const tool = portal.server.registerTool(
    "datastore.rename",
    {
      title: "Rename Datastore",
      description:
        "Rename an existing Datastore by specifying its current name and the new name",
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      inputSchema: {
        oldName: z.string().min(1).describe("Current name of the datastore"),
        newName: z.string().min(1).describe("New name for the datastore"),
      },
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
                    db_type: z.enum(["TEXT", "INTEGER", "REAL", "BLOB"]),
                  })
                ),
              })
            ),
          }),
        }),
      },
    },
    async ({ oldName, newName }) => {
      // First, find the datastore by its old name
      const existingDatastore = await portal.db
        .selectFrom("datastore")
        .where("organization_id", "=", args.activeOrganizationId)
        .where("internal_name", "=", oldName)
        .selectAll()
        .executeTakeFirst();

      if (!existingDatastore) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Datastore "${oldName}" not found in your organization`,
            },
          ],
        } as any;
      }

      // Call the rename controller
      const [datastore, error] = await portal.ctrl(
        {
          db: portal.db,
          session: { activeOrganizationId: args.activeOrganizationId },
        },
        { id: existingDatastore.id, internalName: newName }
      );

      if (error) {
        const errMsg = tExternal("en", error);
        return {
          isError: true,
          content: [{ type: "text", text: errMsg }],
        } as any;
      }

      const { id, internal_name, status, provider, schema_json } = datastore;

      return {
        structuredContent: {
          result: { id, internal_name, status, provider, schema_json },
        },
      };
    }
  );

  return [tool, null];
}
