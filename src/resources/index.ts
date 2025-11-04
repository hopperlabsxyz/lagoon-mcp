/**
 * Resource Registry
 *
 * Central registry for all MCP resources.
 * Resources provide static content like documentation and schemas.
 */

import { ReadResourceRequest, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource Registry
 * Add resources here as they are implemented
 */
export const resources: Record<string, Resource> = {
  // Resources will be added in later phases:
  // - graphql://schema - GraphQL schema documentation
  // - doc://api-reference - API reference documentation
  // - doc://getting-started - Getting started guide
};

/**
 * Handle resource read requests
 */
export function handleResourceRead(request: ReadResourceRequest): ReadResourceResult {
  const uri = request.params.uri;

  // For now, return an error since no resources are implemented yet
  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: `Resource "${uri}" is not yet implemented. Resources will be added in later phases.`,
      },
    ],
  };
}
