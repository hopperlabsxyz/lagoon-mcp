/**
 * Lagoon MCP Server
 *
 * Modern implementation using McpServer API for:
 * - Automatic capability management
 * - Clean tool/resource/prompt registration
 * - Future-proof architecture
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { config } from './config.js';
import { checkBackendHealth, graphqlClient } from './graphql/client.js';

// Dependency injection
import { createContainer } from './core/container.js';
import { createNodeCacheAdapter } from './core/cache-adapter.js';

// Tool registry
import { registerTools } from './tools/registry.js';

// Resource imports
import { getGraphQLSchema } from './resources/schema.js';
import { getDefiGlossary } from './resources/glossary.js';

// Prompt imports
import { getFinancialAnalysisPrompt } from './prompts/financial-analysis.js';
import { getCuratorPerformancePrompt } from './prompts/curator-performance.js';
import { getCompetitorComparisonPrompt } from './prompts/competitor-comparison.js';
import { getOnboardingFirstVaultPrompt } from './prompts/onboarding-first-vault.js';
import { getProtocolOverviewPrompt } from './prompts/protocol-overview.js';
import { getPortfolioOptimizationPrompt } from './prompts/portfolio-optimization.js';

/**
 * Create and configure the MCP server instance
 *
 * Uses modern McpServer API for automatic capability management
 * and clean registration patterns.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'lagoon-mcp',
    version: '0.2.21',
  });

  // ==========================================
  // Dependency Injection Container
  // ==========================================

  // Create service container with all dependencies
  const container = createContainer(
    graphqlClient,
    createNodeCacheAdapter({
      stdTTL: config.cache.stdTTL,
      checkperiod: config.cache.checkperiod,
      maxKeys: config.cache.maxKeys,
    }),
    config
  );

  // ==========================================
  // Tool Registration
  // ==========================================

  // Register all tools from unified registry with DI container
  registerTools(server, container);

  // ==========================================
  // Resource Registration
  // ==========================================

  server.registerResource(
    'graphql-schema',
    'lagoon://graphql-schema',
    {
      title: 'GraphQL Schema',
      description:
        'Complete GraphQL schema in SDL format. ' +
        'Includes all types, queries, and mutations for the Lagoon API. ' +
        'Cached for 24 hours.',
      mimeType: 'text/plain',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/plain',
          text: await getGraphQLSchema(),
        },
      ],
    })
  );

  server.registerResource(
    'defi-glossary',
    'lagoon://defi-glossary',
    {
      title: 'DeFi Glossary',
      description:
        'Comprehensive terminology guide for Lagoon DeFi Protocol. ' +
        'Explains vault concepts, financial metrics, transaction types, and calculations. ' +
        'Essential reference for understanding vault data and analysis.',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: getDefiGlossary(),
        },
      ],
    })
  );

  // ==========================================
  // Prompt Registration
  // ==========================================

  server.registerPrompt(
    'financial-analysis',
    {
      title: 'Financial Analysis',
      description:
        'Guidance for analyzing DeFi vault data and generating financial insights. ' +
        'Includes analysis patterns for portfolio review, vault performance, and vault discovery. ' +
        'Provides frameworks for risk assessment, metrics interpretation, and report structure.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getFinancialAnalysisPrompt(),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'curator-performance',
    {
      title: 'Curator Performance Intelligence',
      description:
        'Comprehensive framework for evaluating curator performance, reputation, and vault management capabilities. ' +
        'Includes metrics for weighted APR, Sharpe ratio, consistency analysis, and reputation scoring. ' +
        'Provides curator selection criteria, trust signals, and monitoring frameworks.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getCuratorPerformancePrompt(),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'competitor-comparison',
    {
      title: 'Competitor Comparison Framework',
      description:
        'Objective comparison of Lagoon Protocol against major competitors (Gauntlet, Veda, Ether.fi). ' +
        'Includes financial performance, platform features, security metrics, and use case recommendations. ' +
        'Provides scenario-based guidance and migration considerations.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getCompetitorComparisonPrompt(),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'onboarding-first-vault',
    {
      title: 'Onboarding: First Vault Selection',
      description:
        'Structured guidance for new users selecting their first vault with confidence-building approach. ' +
        'Includes 5-step selection process, risk assessment, performance validation, and curator credibility checks. ' +
        'Provides beginner-friendly decision frameworks and best practices.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getOnboardingFirstVaultPrompt(),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'protocol-overview',
    {
      title: 'Protocol Overview & KPI Dashboard',
      description:
        'Real-time protocol health insights and competitive positioning analysis. ' +
        'Includes TVL trends, vault performance metrics, user growth, ecosystem health, and security assessment. ' +
        'Provides protocol health scoring and competitive benchmarking.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getProtocolOverviewPrompt(),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'portfolio-optimization',
    {
      title: 'Portfolio Optimization Engine',
      description:
        'Modern Portfolio Theory (MPT) based optimization for vault portfolio management. ' +
        'Includes correlation analysis, efficient frontier calculation, Sharpe ratio optimization, and rebalancing strategies. ' +
        'Provides risk-return optimization and diversification recommendations.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getPortfolioOptimizationPrompt(),
          },
        },
      ],
    })
  );

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
  console.error('  Server: McpServer (modern API)');
  console.error('  Capabilities: Auto-managed');
}
