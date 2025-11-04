# Lagoon MCP - Architecture Documentation

## System Overview

Lagoon MCP is a TypeScript-based MCP server that provides conversational access to Lagoon DeFi vault data through GraphQL queries.

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Claude    │ ◄─MCP──►│  Lagoon MCP  │◄─GraphQL─►│  Backend   │
│    Code     │         │    Server    │         │     API     │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Cache
                              ▼
                        ┌──────────────┐
                        │  node-cache  │
                        └──────────────┘
```

**Flow**:
1. User asks Claude a question about vaults
2. Claude decides which MCP tool to call
3. MCP server builds GraphQL query
4. MCP checks cache, fetches if needed
5. MCP returns structured data to Claude
6. Claude analyzes and generates report

---

## Core Components

### 1. MCP Server (`src/index.ts`, `src/server.ts`)

Entry point that sets up the MCP server with stdio transport.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'lagoon-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},      // 5 tools
      resources: {},  // 2 resources
      prompts: {},    // 1 prompt
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools[request.params.name];
  return await tool.handler(request.params.arguments);
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 2. GraphQL Client (`src/graphql/client.ts`)

Configured graphql-request client for backend communication.

```typescript
import { GraphQLClient } from 'graphql-request';

const GRAPHQL_ENDPOINT =
  process.env.LAGOON_GRAPHQL_URL ||
  'http://localhost:3000/query';

export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {},
  timeout: 30000, // 30 seconds
});

// Usage
import { gql } from 'graphql-tag';
import { graphqlClient } from './client.js';

const query = gql`
  query GetVault($address: Address!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      id
      symbol
    }
  }
`;

const data = await graphqlClient.request(query, { address, chainId });
```

### 3. Type Generation (`src/types/generated.ts`)

Auto-generated TypeScript types from GraphQL schema using graphql-codegen.

**codegen.yml**:
```yaml
schema: 'http://localhost:3000/query'
generates:
  ./src/types/generated.ts:
    plugins:
      - 'typescript'
      - 'typescript-operations'
    config:
      scalars:
        BigInt: 'string'
        Address: 'string'
        Hex: 'string'
```

**Usage**:
```typescript
import type { Vault, VaultState, User } from './types/generated.js';

function processVault(vault: Vault) {
  console.log(vault.symbol);
  console.log(vault.state.totalAssetsUsd);
}
```

### 4. Caching Layer (`src/cache/index.ts`)

In-memory cache with TTL using node-cache.

```typescript
import NodeCache from 'node-cache';

export const cache = new NodeCache({
  stdTTL: 600,           // Default 10 minutes
  checkperiod: 120,      // Check expired keys every 2 min
  useClones: false,      // Performance optimization
  maxKeys: 1000,         // Max entries
});

export const cacheTTL = {
  vaultData: 900,        // 15 minutes
  userPortfolio: 300,    // 5 minutes
  searchResults: 600,    // 10 minutes
  performance: 1800,     // 30 minutes
  schema: 86400,         // 24 hours
};

export const cacheKeys = {
  vaultData: (address: string, chainId: number) =>
    `vault:${address}:${chainId}`,

  userPortfolio: (address: string, chainIds: number[]) =>
    `portfolio:${address}:${chainIds.sort().join(',')}`,

  searchVaults: (filters: any) =>
    `search:${hashObject(filters)}`,

  vaultPerformance: (address: string, chainId: number, range: string) =>
    `perf:${address}:${chainId}:${range}`,
};

// Helper for cache hash
function hashObject(obj: any): string {
  return JSON.stringify(obj);
}
```

**Usage in Tools**:
```typescript
async function getVaultData(address: string, chainId: number) {
  const cacheKey = cacheKeys.vaultData(address, chainId);

  // Check cache
  const cached = cache.get<Vault>(cacheKey);
  if (cached) return cached;

  // Fetch from GraphQL
  const data = await graphqlClient.request(GET_VAULT_QUERY, { address, chainId });

  // Store in cache
  cache.set(cacheKey, data.vaultByAddress, cacheTTL.vaultData);

  return data.vaultByAddress;
}
```

### 5. Input Validation (`src/utils/validators.ts`)

Zod schemas for runtime type validation of tool inputs.

```typescript
import { z } from 'zod';

// Reusable schemas
export const ethereumAddressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Invalid Ethereum address format'
);

export const chainIdSchema = z.number().int().positive();

// Tool input schemas
export const getVaultDataInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  fields: z.array(z.string()).optional(),
});

export const getUserPortfolioInputSchema = z.object({
  userAddress: ethereumAddressSchema,
  chainIds: z.array(chainIdSchema).optional(),
});

export const searchVaultsInputSchema = z.object({
  filters: z.object({
    assetSymbol: z.string().optional(),
    chainId: chainIdSchema.optional(),
    minTvl: z.number().positive().optional(),
    maxTvl: z.number().positive().optional(),
    curatorIds: z.array(z.string()).optional(),
    isVisible: z.boolean().optional(),
  }).optional(),
  pagination: z.object({
    first: z.number().int().positive().max(1000).optional(),
    skip: z.number().int().nonnegative().optional(),
  }).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

// Usage
try {
  const validated = getVaultDataInputSchema.parse(input);
  // ... use validated data
} catch (error) {
  throw new ValidationError(error.message);
}
```

### 6. Error Handling (`src/utils/errors.ts`)

Custom error types and formatting.

```typescript
export class GraphQLError extends Error {
  constructor(message: string, public errors: any[]) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export function formatError(error: unknown): string {
  if (error instanceof GraphQLError) {
    return `GraphQL Error: ${error.message}\n${JSON.stringify(error.errors, null, 2)}`;
  }
  if (error instanceof ValidationError) {
    return `Validation Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown Error: ${error}`;
}

// Standard error response for tools
export function errorResponse(error: unknown) {
  return {
    content: [{
      type: 'text',
      text: formatError(error),
    }],
    isError: true,
  };
}
```

---

## Tools Implementation Pattern

Each tool follows this structure:

```typescript
// src/tools/example-tool.ts
import { z } from 'zod';
import { gql } from 'graphql-tag';
import type { ExampleType } from '../types/generated.js';
import { graphqlClient } from '../graphql/client.js';
import { cache, cacheKeys, cacheTTL } from '../cache/index.js';
import { errorResponse } from '../utils/errors.js';

// 1. Define input schema
const InputSchema = z.object({
  param1: z.string(),
  param2: z.number(),
});

export type ExampleInput = z.infer<typeof InputSchema>;

// 2. Define GraphQL query
const EXAMPLE_QUERY = gql`
  query ExampleQuery($param1: String!, $param2: Int!) {
    example(param1: $param1, param2: $param2) {
      id
      field1
      field2
    }
  }
`;

// 3. Implement handler
export async function exampleTool(input: unknown) {
  try {
    // Validate input
    const validated = InputSchema.parse(input);

    // Check cache
    const cacheKey = cacheKeys.example(validated.param1, validated.param2);
    const cached = cache.get<ExampleType>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        isError: false,
      };
    }

    // Fetch from GraphQL
    const data = await graphqlClient.request(EXAMPLE_QUERY, validated);

    // Store in cache
    cache.set(cacheKey, data.example, cacheTTL.example);

    // Return result
    return {
      content: [{ type: 'text', text: JSON.stringify(data.example, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}

// 4. Tool definition for MCP
export const exampleToolDef = {
  name: 'example_tool',
  description: 'Description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Description of param1' },
      param2: { type: 'number', description: 'Description of param2' },
    },
    required: ['param1', 'param2'],
  },
  handler: exampleTool,
};
```

---

## Resources Implementation Pattern

```typescript
// src/resources/example-resource.ts
import { cache, cacheTTL } from '../cache/index.js';

export async function getExampleResource() {
  const cacheKey = 'resource:example';

  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  // Generate resource content
  const content = generateContent();

  cache.set(cacheKey, content, cacheTTL.schema);
  return content;
}

export const exampleResourceDef = {
  uri: 'lagoon://example',
  name: 'Example Resource',
  description: 'Description of the resource',
  mimeType: 'text/plain',
  handler: getExampleResource,
};
```

---

## Prompts Implementation Pattern

```typescript
// src/prompts/example-prompt.ts

export const examplePrompt = {
  name: 'example_prompt',
  description: 'Description of the prompt',
  handler: async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `
# Example Prompt

Guidance for Claude on how to use the tools...
        `.trim(),
      },
    }],
  }),
};
```

---

## Registry Pattern

Centralize tool/resource/prompt registration:

```typescript
// src/tools/index.ts
import { queryGraphQLToolDef } from './query-graphql.js';
import { getVaultDataToolDef } from './vault-data.js';
// ... other imports

export const tools = {
  query_graphql: queryGraphQLToolDef,
  get_vault_data: getVaultDataToolDef,
  get_user_portfolio: getUserPortfolioToolDef,
  search_vaults: searchVaultsToolDef,
  get_vault_performance: getVaultPerformanceToolDef,
};

// src/resources/index.ts
import { graphqlSchemaResourceDef } from './schema.js';
import { defiGlossaryResourceDef } from './glossary.js';

export const resources = {
  'lagoon://schema/graphql': graphqlSchemaResourceDef,
  'lagoon://glossary/defi': defiGlossaryResourceDef,
};

// src/prompts/index.ts
import { financialAnalysisPrompt } from './financial-analysis.js';

export const prompts = {
  financial_analysis: financialAnalysisPrompt,
};
```

---

## Configuration (`src/config.ts`)

Centralized configuration management:

```typescript
export const config = {
  graphql: {
    endpoint: process.env.LAGOON_GRAPHQL_URL || 'http://localhost:3000/query',
    timeout: 30000,
  },
  cache: {
    stdTTL: 600,
    checkperiod: 120,
    maxKeys: 1000,
  },
  server: {
    name: 'lagoon-mcp',
    version: '1.0.0',
  },
};
```

---

## Testing Strategy

### Unit Tests

Test individual tools in isolation with mocked GraphQL client.

```typescript
// tests/tools/vault-data.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getVaultData } from '../../src/tools/vault-data.js';
import { graphqlClient } from '../../src/graphql/client.js';
import { cache } from '../../src/cache/index.js';

vi.mock('../../src/graphql/client.js');

describe('getVaultData', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('should fetch vault data successfully', async () => {
    const mockVault = {
      id: 'vault-1',
      symbol: 'lgUSDC',
      state: { totalAssetsUsd: 1000000 },
    };

    vi.mocked(graphqlClient.request).mockResolvedValue({
      vaultByAddress: mockVault,
    });

    const result = await getVaultData({
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
    });

    expect(result.isError).toBe(false);
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBe('lgUSDC');
  });

  it('should use cached data on second call', async () => {
    const input = {
      vaultAddress: '0x1234567890123456789012345678901234567890',
      chainId: 42161,
    };

    const mockVault = {
      id: 'vault-1',
      symbol: 'lgUSDC',
    };

    vi.mocked(graphqlClient.request).mockResolvedValue({
      vaultByAddress: mockVault,
    });

    // First call
    await getVaultData(input);
    expect(graphqlClient.request).toHaveBeenCalledTimes(1);

    // Second call (should use cache)
    await getVaultData(input);
    expect(graphqlClient.request).toHaveBeenCalledTimes(1); // No additional call
  });

  it('should validate input address format', async () => {
    const result = await getVaultData({
      vaultAddress: 'invalid',
      chainId: 42161,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid Ethereum address');
  });
});
```

### Integration Tests

Test with real backend (local development).

```typescript
// tests/integration/tools.integration.test.ts
import { describe, it, expect } from 'vitest';
import { getVaultData } from '../../src/tools/vault-data.js';

describe('Integration Tests', () => {
  it('should fetch real vault data from backend', async () => {
    const result = await getVaultData({
      vaultAddress: '0xREAL_VAULT_ADDRESS',
      chainId: 42161,
    });

    expect(result.isError).toBe(false);
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('symbol');
    expect(data).toHaveProperty('state');
  });
}, { timeout: 30000 });
```

---

## Build & Distribution

### Build Process

```bash
# Compile TypeScript
npm run build

# Output: dist/
# - index.js (entry point)
# - index.d.ts (type declarations)
# - All other compiled files
```

### NPM Package Structure

```
dist/
├── index.js
├── index.d.ts
├── server.js
├── server.d.ts
├── tools/
│   ├── query-graphql.js
│   ├── vault-data.js
│   └── ...
├── graphql/
│   └── client.js
├── cache/
│   └── index.js
└── utils/
    └── validators.js
```

### Installation

```bash
# Global installation
npm install -g @yourorg/lagoon-mcp

# Local installation
npm install @yourorg/lagoon-mcp
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "lagoon": {
      "command": "lagoon-mcp",
      "env": {
        "LAGOON_GRAPHQL_URL": "https://api.lagoon.finance/query"
      }
    }
  }
}
```

---

## Performance Optimization

### 1. Caching Strategy

- Cache frequently accessed data
- TTL based on data volatility
- Max 1000 cache entries (LRU eviction)

### 2. Query Optimization

- Select only needed fields
- Use filters on server side
- Implement pagination for large results

### 3. Parallel Queries

For multi-chain operations:
```typescript
const portfolios = await Promise.all(
  chainIds.map(chainId => getUserPortfolio(userAddress, chainId))
);
```

### 4. Type Safety

- Zero runtime overhead with TypeScript
- All types generated from schema
- Validation only at boundaries (tool inputs)

---

## Security Considerations

### Input Validation

- All tool inputs validated with Zod
- Ethereum address format verification
- Numeric range checks
- SQL injection N/A (GraphQL parameterized)

### Error Handling

- Never expose internal errors to Claude
- Sanitize error messages
- Log detailed errors server-side

### Rate Limiting

- Currently: None (public API)
- Future: Implement if backend adds rate limits
- Strategy: Exponential backoff, request queuing

---

## Troubleshooting

### Common Issues

**1. Connection Timeout**
```
Error: Request timeout
```
Solution: Check LAGOON_GRAPHQL_URL, verify backend is running

**2. GraphQL Errors**
```
GraphQL Error: Vault not found
```
Solution: Verify address and chainId are correct

**3. Cache Issues**
```
Stale data returned
```
Solution: Clear cache or reduce TTL

**4. Type Errors**
```
Type 'unknown' is not assignable to type 'Vault'
```
Solution: Run `npm run codegen` to regenerate types

---

## Monitoring & Observability

### Logging

```typescript
// src/utils/logger.ts
export function log(level: 'info' | 'warn' | 'error', message: string, meta?: any) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }));
}

// Usage
log('info', 'Vault data fetched', { address, chainId });
log('error', 'GraphQL request failed', { error: error.message });
```

### Metrics

Track in production:
- Request count per tool
- Cache hit/miss rate
- Average response time
- Error rate

---

## Future Enhancements

### Phase 2 Features

1. **Streaming Responses** - For large datasets
2. **Query Builder UI** - Visual query construction
3. **Advanced Filtering** - Regex, fuzzy search
4. **Export Capabilities** - CSV, JSON downloads
5. **Webhook Integration** - Real-time vault updates

### Scalability

1. **Distributed Cache** - Redis instead of node-cache
2. **Load Balancing** - Multiple MCP instances
3. **Database** - Persistent storage for analytics
4. **CDN** - Cache GraphQL responses at edge

---

## Development Workflow

1. **Branch Strategy**: `main` (production), `develop` (staging), `feature/*`
2. **Testing**: Run tests before commit (`npm test`)
3. **Type Check**: Ensure no type errors (`tsc --noEmit`)
4. **Linting**: Format code (`npm run lint`)
5. **Commits**: Conventional commits (feat, fix, docs, etc.)
6. **PR Review**: Require approval before merge
7. **Release**: Tag versions, publish to npm

---

## Resources

- **MCP SDK Docs**: https://modelcontextprotocol.io
- **GraphQL Docs**: https://graphql.org
- **graphql-request**: https://github.com/jasonkuhrt/graphql-request
- **Zod Docs**: https://zod.dev
- **Vitest Docs**: https://vitest.dev

This architecture provides a solid foundation for building a reliable, performant, and maintainable MCP server!
