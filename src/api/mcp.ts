
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

import {
  isInitializeRequest
} from '@modelcontextprotocol/sdk/types.js';

import { cors } from '@elysiajs/cors';
import { listMcpKeysController } from '@server/controllers/ctrl.mcp.list';
import { kysely } from '@server/db';
import { createMcpServerFn } from '@server/subroutines/mcp/create-mcp-server.fn';
import { ElysiaStreamingHttpTransport, type McpContext } from '@server/utils/elysia-streaming-httptransport';
import { Elysia, status } from 'elysia';


// ============================================================================
// Transport Storage
// ============================================================================

const transports: { [sessionId: string]: ElysiaStreamingHttpTransport } = {};

// ============================================================================
// Elysia Route Handlers
// ============================================================================

export const apiMcpServer = new Elysia({ prefix: '/mcp', name: 'McpServer' })
  .use(
    // cors({
    // origin: 'localhost:6274', // works for local development, alternatively use true if dev mode, must update this line
    // })
    cors()
  )
  .post('/', async (ctx) => {
    const key = ctx.query.key ?? (ctx.headers.authorization ? ctx.headers.authorization.split(' ')[1] : null);
    if (!key) {
      return status(401, { error: 'Unauthorized' });
    }

    const mcpKey = await kysely.selectFrom('mcpkey').where("id", "=", key).selectAll().executeTakeFirst();
    if (!mcpKey) {
      return status(401, { error: 'Unauthorized' });
    }

    // Check for existing session ID
    const sessionId = ctx.headers['mcp-session-id'];
    let transport: ElysiaStreamingHttpTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(ctx.body)) {
      // New initialization request
      transport = new ElysiaStreamingHttpTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sessionId: string) => {
          // Store the transport by session ID
          transports[sessionId] = transport;
        },
        enableJsonResponse: true,
        enableLogging: false
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const [mcpKeys, error] = await listMcpKeysController({db: kysely, session: {activeOrganizationId: mcpKey.organization_id} as any})
      if (error) {
        return status(500, { error: 'Internal Server Error' });
      }
      const mcpKeyObj = mcpKeys.find(key => key.id === mcpKey.id);
      if (!mcpKeyObj) {
        return status(401, { error: 'Unauthorized' });
      }

      const server = await createMcpServerFn({db: kysely}, {mcpKey: mcpKeyObj, organizationId: mcpKey.organization_id})

      // Connect to the MCP server
      await server.connect(transport);
    } else {
      return status(400, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided'
        },
        id: null
      });
    }

    // Create MCP context from Elysia context
    const mcpContext: McpContext = {
      request: ctx.request,
      set: ctx.set,
      headers: ctx.headers as Record<string, string | undefined>,
      body: ctx.body,
      store: {
        authInfo: {
          keyId: mcpKey.id
        }
      }
    };

    // Handle the request via transport
    return await transport.handleRequest(mcpContext);
  })
  .get('/', async (ctx) => {
    const key = ctx.query.key ?? (ctx.headers.authorization ? ctx.headers.authorization.split(' ')[1] : null);
    if (!key) {
      return status(401, { error: 'Unauthorized' });
    }

    const mcpKey = await kysely.selectFrom('mcpkey').where("id", "=", key).selectAll().executeTakeFirst();
    if (!mcpKey) {
      return status(401, { error: 'Unauthorized' });
    }

    const sessionId = ctx.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
      return status(400, {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Invalid or missing session ID'
        },
        id: null
      });
    }

    const transport = transports[sessionId];

    // Create MCP context from Elysia context
    const mcpContext: McpContext = {
      request: ctx.request,
      set: ctx.set,
      headers: ctx.headers as Record<string, string | undefined>,
      body: ctx.body,
      store: {
        authInfo: {
          keyId: mcpKey.id
        }
      }
    };

    // Handle the GET request (SSE stream)
    return await transport.handleRequest(mcpContext);
  })