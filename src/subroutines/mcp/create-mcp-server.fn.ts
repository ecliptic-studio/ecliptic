import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDatastoreController } from "@server/controllers/ctrl.datastore.create";
import { dropDatastoreController } from "@server/controllers/ctrl.datastore.drop";
import { renameDatastoreController } from "@server/controllers/ctrl.datastore.rename";
import type { TKysely } from "@server/db";
import type { TMcpKey } from "@server/dto/TMcp";
import { toolDatastoreCreateTx } from "./tools/tool.datastore.create.tx";
import { toolDatastoreDropTx } from "./tools/tool.datastore.drop.tx";
import { toolDatastoreListFx } from "./tools/tool.datastore.list.fx";
import { toolDatastoreRenameTx } from "./tools/tool.datastore.rename.tx";
import { toolTableListFx } from "./tools/tool.table.list.fx";
import { toolTableQueryTx } from "./tools/tool.table.query.tx";

type TPortal = {
  db: TKysely;
}

type TArgs = {
  mcpKey: TMcpKey,
  organizationId: string
}

const toolList = {

}

export async function createMcpServerFn(portal: TPortal, args: TArgs) {
  const server = new McpServer({
    name: `Ecliptic ${args.mcpKey.internal_name}`,
    version: '1.0.0',
  });

  const [toolCreateDatastore, error1] = toolDatastoreCreateTx({server, ctrl: createDatastoreController, db: portal.db}, {activeOrganizationId: args.organizationId})
  if(error1) throw error1

  const [toolDropDatastore, error2] = toolDatastoreDropTx({server, ctrl: dropDatastoreController, db: portal.db}, {activeOrganizationId: args.organizationId})
  if(error2) throw error2

  const [toolListDatastores, error3] = toolDatastoreListFx({server, db: portal.db}, {activeOrganizationId: args.organizationId, mcpKeyId: args.mcpKey.id})
  if(error3) throw error3

  const [toolRenameDatastore, error4] = toolDatastoreRenameTx({server, ctrl: renameDatastoreController, db: portal.db}, {activeOrganizationId: args.organizationId})
  if(error4) throw error4

  const [toolListTables, error5] = toolTableListFx({server, db: portal.db}, {activeOrganizationId: args.organizationId, mcpKeyId: args.mcpKey.id})
  if(error5) throw error5

  const [toolQueryTable, error6] = toolTableQueryTx({server, db: portal.db}, {activeOrganizationId: args.organizationId, mcpKeyId: args.mcpKey.id})
  if(error6) throw error6

  return server

}