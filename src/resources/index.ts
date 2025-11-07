/**
 * Resource Registry
 *
 * Central registry for all MCP resources.
 * Resources provide static content like documentation and schemas.
 */

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource Registry
 * Resources available to MCP clients
 */
export const resources: Resource[] = [
  {
    uri: 'lagoon://graphql-schema',
    name: 'GraphQL Schema',
    description:
      'Complete GraphQL schema in SDL format. ' +
      'Includes all types, queries, and mutations for the Lagoon API. ' +
      'Cached for 24 hours.',
    mimeType: 'text/plain',
  },
  {
    uri: 'lagoon://defi-glossary',
    name: 'DeFi Glossary',
    description:
      'Comprehensive terminology guide for Lagoon DeFi Protocol. ' +
      'Explains vault concepts, financial metrics, transaction types, and calculations. ' +
      'Essential reference for understanding vault data and analysis.',
    mimeType: 'text/markdown',
  },
];
