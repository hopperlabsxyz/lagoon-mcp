/**
 * Lagoon MCP Server
 *
 * Initializes and configures the Model Context Protocol server with:
 * - Tool handlers for Lagoon protocol interactions
 * - Resource providers for documentation and schemas
 * - Prompt templates for common queries
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { config } from './config.js';
import { checkBackendHealth } from './graphql/client.js';
import { tools, handleToolCall } from './tools/index.js';
import { resources, handleResourceRead } from './resources/index.js';
import { prompts, handlePromptGet } from './prompts/index.js';

/**
 * Create and configure the MCP server instance
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'lagoon-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => handleToolCall(request));

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: Object.values(resources),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, (request) => handleResourceRead(request));

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: Object.values(prompts),
  }));

  server.setRequestHandler(GetPromptRequestSchema, (request) => handlePromptGet(request));

  return server;
}

/**
 * Run the MCP server
 */
export async function runServer(): Promise<void> {
  // Validate configuration
  console.error('Starting Lagoon MCP Server...');
  console.error(`GraphQL Endpoint: ${config.graphql.endpoint}`);
  console.error(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Check backend health
  console.error('Checking backend connection...');
  try {
    const isHealthy = await checkBackendHealth();
    if (isHealthy) {
      console.error('✓ Backend connection successful');
    } else {
      console.error('⚠ Backend health check failed, continuing anyway...');
    }
  } catch (error) {
    console.error('⚠ Cannot reach backend, continuing anyway...');
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Create and start server
  const server = createServer();
  const transport = new StdioServerTransport();

  console.error('Connecting to stdio transport...');
  await server.connect(transport);

  console.error('✓ Lagoon MCP Server is running');
  console.error(`  Tools: ${tools.length}`);
  console.error(`  Resources: ${Object.keys(resources).length}`);
  console.error(`  Prompts: ${Object.keys(prompts).length}`);
}
