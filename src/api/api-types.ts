// Controller handles HTTP related eg. routing, request validation
import { z } from 'zod';

export const apiTypes = {
  '/api/v1/datastore/:id/schema': {
    params: {
      id: z.string().min(1)
    },
    PATCH: {
      body: z.union([
        z.object({
          type: z.literal('add-column'),
          table: z.string().min(1),
          column: z.string().min(1),
          db_type: z.union([
            z.literal('TEXT'),
            z.literal('INTEGER'),
            z.literal('REAL'),
            z.literal('BLOB')
          ]),
          foreign_key: z.optional(z.object({
            table: z.string().min(1),
            column: z.string().min(1)
          }))
        }),
        z.object({
          type: z.literal('drop-column'),
          table: z.string().min(1),
          column: z.string().min(1)
        }),
        z.object({
          type: z.literal('rename-column'),
          table: z.string().min(1),
          column: z.string().min(1),
          new_name: z.string().min(1)
        }),
        z.object({
          type: z.literal('rename-table'),
          table: z.string().min(1),
          new_name: z.string().min(1)
        }),
        z.object({
          type: z.literal('add-table'),
          table: z.string().min(1)
        }),
        z.object({
          type: z.literal('drop-table'),
          table: z.string().min(1)
        })
      ]),
    }
  },
  '/api/v1/datastore/:id': {
    params: {
      id: z.string().min(1)
    },
    PATCH: {
      body: z.object({
        internalName: z.string().min(1).max(255),
      }),
    }
  },
  '/api/v1/mcp-keys': {
    POST: {
      body: z.object({
        name: z.string().min(1),
        permissions: z.array(z.object({ actionId: z.string(), targetId: z.string() }))
      })
    }
  },
  '/api/v1/mcp-keys/:id': {
    params: {
      id: z.string().min(1)
    },
    PATCH: {
      body: z.object({
        name: z.string().min(1).optional(),
        permissions: z.array(z.object({ actionId: z.string(), targetId: z.string() }))
      })
    }
  }
}