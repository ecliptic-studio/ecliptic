
/**
 * This is not /api/mcp* which is used to setup mcp endpoints, but the mcp server itself.
 * Listening to /mcp
 * MCP clients will connect to this endpoint.
 * If you need to change mcp settings api refer to @src/api/api.mcp.ts
 *
 * This file is special and does not follow the rest of the server structure.
 * That is okay. We want to avoid unnecessary complexity to the server structure.
 *
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { listMcpKeysController } from '@server/controllers/ctrl.mcp.list';
import { kysely } from '@server/db';
import { createMcpServerFn } from '@server/subroutines/mcp/create-mcp-server.fn';
import type { BunRequest, Serve, Server } from 'bun';
import { toFetchResponse, toReqRes } from 'fetch-to-node';


export const apiMcp: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/mcp'>, Server<undefined>, Response>>> = {
  POST: async (request, server) => {
    const key = new URLSearchParams(request.url.split('?')[1]).get('key') ?? (request.headers.get('authorization')?.split(' ')[1] ?? null)
    if (!key) {
      return new Response('Unauthorized', { status: 401 });
    }

    const mcpKey = await kysely.selectFrom('mcpkey').where("id", "=", key).selectAll().executeTakeFirst();
    if (!mcpKey) {
      return new Response('Unauthorized', { status: 401 });
    }

    const [mcpKeys, error] = await listMcpKeysController({db: kysely, session: {activeOrganizationId: mcpKey.organization_id} as any})
    if (error) {
      return new Response('Internal Server Error', { status: 500 });
    }
    const mcpKeyObj = mcpKeys.find(key => key.id === mcpKey.id);
    if (!mcpKeyObj) {
      return new Response('Unauthorized', { status: 401 });
    }

    const mcpServer = await createMcpServerFn({db: kysely}, {mcpKey: mcpKeyObj, organizationId: mcpKey.organization_id})


    const { req, res } = toReqRes(request);
    
    try {
      const body = await request.json();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });

      res.on('close', () => {
        transport.close();
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        return Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        }, { status: 500 })
      }
    }

    return toFetchResponse(res);
  }
}