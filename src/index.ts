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

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const PACKAGE_VERSION = packageJson.version;

function printHelp(): void {
  console.log(`lagoon-mcp ${PACKAGE_VERSION}

Lagoon DeFi vault analytics MCP server.

Usage:
  lagoon-mcp [options]

Options:
  -h, --help       Show this help message
  -v, --version    Show package version`);
}

function handleCliMetadataFlags(args: string[]): boolean {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(PACKAGE_VERSION);
    return true;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return true;
  }

  return false;
}

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
    if (handleCliMetadataFlags(process.argv.slice(2))) {
      return;
    }

    const { runServer } = await import('./server.js');
    const { transport } = await runServer();

    // Graceful shutdown: close transport before exiting
    const shutdown = (): void => {
      void transport.close().finally(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void main();
