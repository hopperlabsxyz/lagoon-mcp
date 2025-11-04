/**
 * GraphQL Client Configuration
 *
 * Configured graphql-request client for Lagoon backend communication
 */

import { GraphQLClient } from 'graphql-request';
import { config } from '../config.js';

/**
 * Shared GraphQL client instance
 *
 * Usage:
 * ```typescript
 * import { graphqlClient } from './graphql/client.js';
 * import { gql } from 'graphql-tag';
 *
 * const query = gql`
 *   query GetVault($address: Address!, $chainId: Int!) {
 *     vaultByAddress(address: $address, chainId: $chainId) {
 *       id
 *       symbol
 *     }
 *   }
 * `;
 *
 * const data = await graphqlClient.request(query, { address, chainId });
 * ```
 */
export const graphqlClient = new GraphQLClient(config.graphql.endpoint, {
  headers: {},
  timeout: config.graphql.timeout,
});

/**
 * Health check function to verify backend connectivity
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const query = `
      query HealthCheck {
        getGlobalTVL
      }
    `;
    await graphqlClient.request(query);
    return true;
  } catch (error) {
    console.error('[GraphQL] Backend health check failed:', error);
    return false;
  }
}
