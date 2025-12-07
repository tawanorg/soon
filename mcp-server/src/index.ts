#!/usr/bin/env node
/**
 * SOON MCP Server
 * Provides token-efficient data access for Claude Code
 *
 * Features:
 * - Query databases and return data in SOON format
 * - Read files and return structured data efficiently
 * - Fetch APIs and compress responses
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { stringify } from '@tawanjs/soon';
import * as fs from 'fs';
import * as path from 'path';

// Create server instance
const server = new Server(
  {
    name: 'soon-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'soon_read_json',
        description: 'Read a JSON file and return it in SOON format (uses fewer tokens). Use this instead of reading JSON directly when you want to save context tokens.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the JSON file',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'soon_fetch_api',
        description: 'Fetch data from an API and return it in SOON format (uses fewer tokens). Ideal for large API responses.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'API URL to fetch',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST'],
              description: 'HTTP method (default: GET)',
            },
            headers: {
              type: 'object',
              description: 'Optional headers',
            },
            body: {
              type: 'string',
              description: 'Optional request body for POST',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'soon_format',
        description: 'Convert JSON data to SOON format. Use this to compress data before including it in responses or context.',
        inputSchema: {
          type: 'object',
          properties: {
            json: {
              type: 'string',
              description: 'JSON string to convert to SOON',
            },
          },
          required: ['json'],
        },
      },
      {
        name: 'soon_query_data',
        description: 'Query and filter JSON data, return results in SOON format. Supports JSONPath-like queries.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to JSON file',
            },
            query: {
              type: 'string',
              description: 'Property path to extract (e.g., "users", "config.database")',
            },
            filter: {
              type: 'object',
              description: 'Filter conditions (e.g., {"active": true})',
            },
            limit: {
              type: 'number',
              description: 'Limit number of results',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'soon_compare_tokens',
        description: 'Compare token counts between JSON and SOON formats. Useful for understanding token savings.',
        inputSchema: {
          type: 'object',
          properties: {
            json: {
              type: 'string',
              description: 'JSON string to analyze',
            },
          },
          required: ['json'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'soon_read_json': {
        const filePath = args?.path as string;
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
          return { content: [{ type: 'text', text: `Error: File not found: ${filePath}` }] };
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const data = JSON.parse(content);
        const soon = stringify(data);

        return {
          content: [{
            type: 'text',
            text: `# Data from ${path.basename(filePath)} (SOON format)\n\n${soon}`,
          }],
        };
      }

      case 'soon_fetch_api': {
        const url = args?.url as string;
        const method = (args?.method as string) || 'GET';
        const headers = args?.headers as Record<string, string> | undefined;
        const body = args?.body as string | undefined;

        const response = await fetch(url, {
          method,
          headers: headers ? new Headers(headers) : undefined,
          body: method === 'POST' ? body : undefined,
        });

        if (!response.ok) {
          return {
            content: [{
              type: 'text',
              text: `Error: API returned ${response.status} ${response.statusText}`,
            }],
          };
        }

        const data = await response.json();
        const soon = stringify(data);

        return {
          content: [{
            type: 'text',
            text: `# API Response (SOON format)\n# Source: ${url}\n\n${soon}`,
          }],
        };
      }

      case 'soon_format': {
        const jsonStr = args?.json as string;
        const data = JSON.parse(jsonStr);
        const soon = stringify(data);

        return {
          content: [{
            type: 'text',
            text: soon,
          }],
        };
      }

      case 'soon_query_data': {
        const filePath = args?.path as string;
        const query = args?.query as string | undefined;
        const filter = args?.filter as Record<string, unknown> | undefined;
        const limit = args?.limit as number | undefined;

        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
          return { content: [{ type: 'text', text: `Error: File not found: ${filePath}` }] };
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        let data = JSON.parse(content);

        // Apply query path
        if (query) {
          const parts = query.split('.');
          for (const part of parts) {
            if (data && typeof data === 'object' && part in data) {
              data = data[part];
            } else {
              return {
                content: [{
                  type: 'text',
                  text: `Error: Path "${query}" not found in data`,
                }],
              };
            }
          }
        }

        // Apply filter
        if (filter && Array.isArray(data)) {
          data = data.filter((item: Record<string, unknown>) => {
            return Object.entries(filter).every(([key, value]) => item[key] === value);
          });
        }

        // Apply limit
        if (limit && Array.isArray(data)) {
          data = data.slice(0, limit);
        }

        const soon = stringify(data);

        return {
          content: [{
            type: 'text',
            text: `# Query Result (SOON format)\n\n${soon}`,
          }],
        };
      }

      case 'soon_compare_tokens': {
        const jsonStr = args?.json as string;
        const data = JSON.parse(jsonStr);
        const soon = stringify(data);
        const jsonMin = JSON.stringify(data);

        // Simple token estimation (rough approximation)
        const estimateTokens = (str: string): number => {
          // Rough estimate: ~4 chars per token for English text
          return Math.ceil(str.length / 4);
        };

        const jsonTokens = estimateTokens(jsonMin);
        const sonoTokens = estimateTokens(soon);
        const savings = ((1 - sonoTokens / jsonTokens) * 100).toFixed(1);

        return {
          content: [{
            type: 'text',
            text: `# Token Comparison

JSON (minified): ~${jsonTokens} tokens (${jsonMin.length} chars)
SOON:            ~${sonoTokens} tokens (${soon.length} chars)

Savings: ${savings}% fewer tokens with SOON

## JSON:
${jsonMin.slice(0, 200)}${jsonMin.length > 200 ? '...' : ''}

## SOON:
${soon.slice(0, 200)}${soon.length > 200 ? '...' : ''}`,
          }],
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`,
          }],
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SOON MCP Server running on stdio');
}

main().catch(console.error);
