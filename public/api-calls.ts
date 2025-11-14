import { type TDatastore } from "@dto/TDatastore";
import { apiTypes } from '@server/api/api-types';
import type { TDataResponse } from '@server/controllers/ctrl.data.get';
import type { TMcpKey } from "@server/dto/TMcp";
import type { TPermissionMeta } from "@server/dto/TPermissionMeta";
import type { TTableData } from '@server/dto/TTableData';
import type { TTableInsertResult } from '@server/dto/TTableInsertResult';
import type { TTableUpdateResult } from '@server/dto/TTableUpdateResult';
import { z } from 'zod';

// Base URL for API calls - can be configured via environment
const API_BASE = '';

// Helper type to infer Zod schema types
type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

// Generic API response wrapper
type ApiResponse<T> = [T, null] | [null, string];

// Helper function to make typed fetch requests
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    return [null, data.error || `HTTP ${response.status}: ${response.statusText}`];
  }

  return [data, null];
}

// ============================================================================
// API Endpoint Functions
// ============================================================================

const apis = {
  '/api/v1/data': {
    /**
     * Get all datastores for the current user
     */
    GET: async () => {
      return apiFetch<{
        datastores: TDataResponse;
      }>(`${API_BASE}/api/v1/data`, {
        method: 'GET',
        credentials: 'include',
      });
    }
  },

  '/api/v1/datastore': {
    /**
     * Create a new datastore
     */
    POST: async (body: InferZodType<typeof apiTypes['/api/v1/datastore']['POST']['body']>) => {
      // Validate body with Zod
      const validated = apiTypes['/api/v1/datastore'].POST.body.safeParse(body);
      if (!validated.success) {
        return [null, validated.error.message] as ApiResponse<TDatastore>;
      }

      return apiFetch<TDatastore>(`${API_BASE}/api/v1/datastore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    }
  },

  '/api/v1/datastore/:id': {
    /**
     * Rename a datastore
     */
    PATCH: async (params: { id: string }, body: InferZodType<typeof apiTypes['/api/v1/datastore/:id']['PATCH']['body']>) => {
      // Validate body with Zod
      const validated = apiTypes['/api/v1/datastore/:id'].PATCH.body.safeParse(body);
      if (!validated.success)
        return [null, validated.error.message];

      return apiFetch<TDatastore>(`${API_BASE}/api/v1/datastore/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    },

    /**
     * Delete a datastore
     */
    DELETE: async (params: { id: string }) => {
      return apiFetch<{ deleted: boolean }>(`${API_BASE}/api/v1/datastore/${params.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }
  },

  '/api/v1/datastore/:id/schema': {
    /**
     * Perform schema changes (add/drop/rename columns, add/drop/rename tables)
     */
    PATCH: async (
      params: { id: string },
      body: InferZodType<typeof apiTypes['/api/v1/datastore/:id/schema']['PATCH']['body']>
    ) => {
      // Validate body with Zod
      const validated = apiTypes['/api/v1/datastore/:id/schema'].PATCH.body.safeParse(body);
      if (!validated.success)
        return [null, validated.error.message];

      return apiFetch<TDatastore>(`${API_BASE}/api/v1/datastore/${params.id}/schema`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    }
  },

  '/api/v1/datastore/:id/table/:tableName': {
    /**
     * Get table data with optional filters, sorting, pagination
     */
    GET: async (
      params: { id: string; tableName: string },
      query?: {
        limit?: number;
        offset?: number;
        select?: string[];
        order?: string;
        [key: string]: any; // For dynamic filter parameters
      }
    ) => {
      const searchParams = new URLSearchParams();

      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => searchParams.append(key, String(v)));
            } else {
              searchParams.append(key, String(value));
            }
          }
        });
      }

      const queryString = searchParams.toString();
      const url = `${API_BASE}/api/v1/datastore/${params.id}/table/${params.tableName}${queryString ? `?${queryString}` : ''}`;

      return apiFetch<TTableData>(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    },

    /**
     * Insert row(s) into a table
     */
    POST: async (
      params: { id: string; tableName: string },
      body: Record<string, any> | Array<Record<string, any>>
    ) => {


      const url = `${API_BASE}/api/v1/datastore/${params.id}/table/${params.tableName}`

      return apiFetch<TTableInsertResult>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
    },

    /**
     * Update rows in a table with optional filters
     */
    PATCH: async (
      params: { id: string; tableName: string },
      body: Record<string, any>,
      query?: Record<string, any>
    ) => {
      const searchParams = new URLSearchParams();

      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => searchParams.append(key, String(v)));
            } else {
              searchParams.append(key, String(value));
            }
          }
        });
      }

      const queryString = searchParams.toString();
      const url = `${API_BASE}/api/v1/datastore/${params.id}/table/${params.tableName}${queryString ? `?${queryString}` : ''}`;

      return apiFetch<TTableUpdateResult>(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
    },

    /**
     * Delete rows from a table by ROWIDs
     */
    DELETE: async (
      params: { id: string; tableName: string },
      body: { rowids: Array<number | string> }
    ) => {
      if (!body.rowids || !Array.isArray(body.rowids) || body.rowids.length === 0) {
        return {
          data: null,
          error: 'rowids array is required and must contain at least one ROWID',
          contentRange: null
        } as const;
      }


      const url = `${API_BASE}/api/v1/datastore/${params.id}/table/${params.tableName}`

      return apiFetch<{deleted: number}>(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
    }
  },

  '/api/v1/mcp-keys': {
    /**
     * List all MCP keys for the current user
     */
    GET: async () => {
      return apiFetch<{
        keys: TMcpKey[];
      }>(`${API_BASE}/api/v1/mcp-keys`, {
        method: 'GET',
        credentials: 'include',
      });
    },

    /**
     * Create a new MCP key
     */
    POST: async (body: InferZodType<typeof apiTypes['/api/v1/mcp-keys']['POST']['body']>) => {
      // Validate body with Zod
      const validated = apiTypes['/api/v1/mcp-keys'].POST.body.safeParse(body);
      if (!validated.success) {
        return [null, validated.error.message] as ApiResponse<TMcpKey>;
      }

      return apiFetch<TMcpKey>(`${API_BASE}/api/v1/mcp-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    }
  },

  '/api/v1/mcp-keys/:id': {
    /**
     * Update an MCP key
     */
    PATCH: async (
      params: { id: string },
      body: InferZodType<typeof apiTypes['/api/v1/mcp-keys/:id']['PATCH']['body']>
    ) => {
      // Validate body with Zod
      const validated = apiTypes['/api/v1/mcp-keys/:id'].PATCH.body.safeParse(body);
      if (!validated.success) {
        return [null, validated.error.message] as ApiResponse<TMcpKey>;
      }

      return apiFetch<TMcpKey>(`${API_BASE}/api/v1/mcp-keys/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    },

    /**
     * Delete an MCP key
     */
    DELETE: async (params: { id: string }) => {
      return apiFetch<{ deleted: true }>(`${API_BASE}/api/v1/mcp-keys/${params.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }
  },

  '/api/v1/permission/targets-and-actions': {
    /**
     * Get permission metadata (available targets and actions)
     */
    GET: async () => {
      return apiFetch<TPermissionMeta>(`${API_BASE}/api/v1/permission/targets-and-actions`, {
        method: 'GET',
        credentials: 'include',
      });
    }
  }
};

export default apis;
