#!/usr/bin/env node

/**
 * Lagoon MCP Server - Entry Point
 *
 * This is the main entry point for the Model Context Protocol (MCP) server
 * that provides tools and resources for interacting with the Lagoon DeFi protocol.
 *
 * The server runs as a stdio transport, making it compatible with Claude Desktop
 * and other MCP clients.
 */

import { runServer } from './server.js';

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the MCP server
async function main(): Promise<void> {
  try {
    await runServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void main();
