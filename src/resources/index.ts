/**
 * Resource Registry
 *
 * Central registry for all MCP resources.
 * Resources provide static content like documentation and schemas.
 */

import { ReadResourceRequest, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { getGraphQLSchema } from './schema.js';
import { getDefiGlossary } from './glossary.js';

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

/**
 * Handle resource read requests
 */
export async function handleResourceRead(
  request: ReadResourceRequest
): Promise<ReadResourceResult> {
  const uri = request.params.uri;

  try {
    switch (uri) {
      case 'lagoon://graphql-schema': {
        const schema = await getGraphQLSchema();
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: schema,
            },
          ],
        };
      }

      case 'lagoon://defi-glossary': {
        const glossary = getDefiGlossary();
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: glossary,
            },
          ],
        };
      }

      default:
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Resource "${uri}" not found. Available resources:\n${resources.map((r) => `- ${r.uri}: ${r.name}`).join('\n')}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error reading resource "${uri}": ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
