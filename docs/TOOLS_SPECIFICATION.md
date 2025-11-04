# Lagoon MCP - Tools Specification

Complete specification for all 5 MCP tools.

---

## Tool 1: `query_graphql`

### Purpose
Direct GraphQL query execution for power users and advanced use cases.

### Complexity
LOW - Straightforward pass-through to GraphQL endpoint

### Caching
NO - User-defined queries cannot be reliably cached

### Input Schema

```typescript
interface QueryGraphQLInput {
  query: string;              // GraphQL query string
  variables?: Record<string, unknown>;  // Optional query variables
}
```

**Zod Validation**:
```typescript
const QueryGraphQLInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  variables: z.record(z.unknown()).optional(),
});
```

### Output Schema

```typescript
interface QueryGraphQLOutput {
  data: unknown;              // GraphQL response data
  errors?: Array<{           // GraphQL errors (if any)
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}
```

### GraphQL Implementation

```typescript
import { graphqlClient } from '../graphql/client.js';

export async function queryGraphQL(input: unknown) {
  try {
    const validated = QueryGraphQLInputSchema.parse(input);

    const result = await graphqlClient.request(
      validated.query,
      validated.variables || {}
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}
```

### MCP Tool Definition

```typescript
export const queryGraphQLTool = {
  name: 'query_graphql',
  description: 'Execute a raw GraphQL query against the Lagoon backend. Use this for advanced queries or when other tools don\'t meet your needs. Returns the raw GraphQL response.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'GraphQL query string (use GraphQL syntax)',
      },
      variables: {
        type: 'object',
        description: 'Optional variables for the query',
      },
    },
    required: ['query'],
  },
  handler: queryGraphQL,
};
```

### Example Usage

**Input**:
```json
{
  "query": "query GetVault($address: Address!, $chainId: Int!) { vaultByAddress(address: $address, chainId: $chainId) { id symbol state { totalAssetsUsd } } }",
  "variables": {
    "address": "0x1234567890123456789012345678901234567890",
    "chainId": 42161
  }
}
```

**Output**:
```json
{
  "vaultByAddress": {
    "id": "vault-arbitrum-0x1234",
    "symbol": "lgUSDC",
    "state": {
      "totalAssetsUsd": 5000000
    }
  }
}
```

### Error Handling

- **Invalid Query**: Return GraphQL syntax error
- **Missing Variables**: Return GraphQL execution error
- **Network Error**: Return connection error message
- **Timeout**: Return timeout error after 30s

---

## Tool 2: `get_vault_data`

### Purpose
Simplified vault information retrieval with all relevant fields and caching.

### Complexity
MEDIUM - Query building, caching, validation

### Caching
YES - 15 minutes TTL, key: `vault:{address}:{chainId}`

### Input Schema

```typescript
interface GetVaultDataInput {
  vaultAddress: string;       // 0x... format, 40 hex chars
  chainId: number;            // Network ID (positive integer)
  fields?: string[];          // Optional: specific fields to return
}
```

**Zod Validation**:
```typescript
const GetVaultDataInputSchema = z.object({
  vaultAddress: z.string().regex(
    /^0x[a-fA-F0-9]{40}$/,
    'Invalid Ethereum address format'
  ),
  chainId: z.number().int().positive(),
  fields: z.array(z.string()).optional(),
});
```

### Output Schema

```typescript
interface GetVaultDataOutput {
  vault: Vault;               // Full vault object with all fields
}

type Vault = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  description: string;
  decimals: number;
  isVisible: boolean;
  state: {
    totalAssetsUsd: number;
    totalSharesIssued: string;  // BigInt as string
  };
  chain: {
    id: string;
    name: string;
    nativeToken: string;
  };
  asset: {
    id: string;
    symbol: string;
    decimals: number;
    logoUrl: string;
  };
  curators: Array<{
    id: string;
    name: string;
  }>;
  integrator: {
    id: string;
    name: string;
  };
};
```

### GraphQL Query

```graphql
query GetVault($address: Address!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    id
    address
    symbol
    name
    description
    shortDescription
    decimals
    maxCapacity
    logoUrl
    isVisible
    inception
    state {
      totalAssetsUsd
      totalSharesIssued
    }
    chain {
      id
      name
      nativeToken
      logoUrl
    }
    asset {
      id
      address
      symbol
      decimals
      logoUrl
      network
    }
    curators {
      id
      name
      description
      logoUrl
    }
    integrator {
      id
      name
      description
      logoUrl
    }
  }
}
```

### Implementation

```typescript
import { gql } from 'graphql-tag';
import type { Vault } from '../types/generated.js';

const GET_VAULT_QUERY = gql`...`; // Query above

export async function getVaultData(input: unknown) {
  try {
    const validated = GetVaultDataInputSchema.parse(input);
    const { vaultAddress, chainId } = validated;

    // Check cache
    const cacheKey = cacheKeys.vaultData(vaultAddress, chainId);
    const cached = cache.get<Vault>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        isError: false,
      };
    }

    // Fetch from GraphQL
    const data = await graphqlClient.request(GET_VAULT_QUERY, {
      address: vaultAddress,
      chainId,
    });

    const vault = data.vaultByAddress;

    // Store in cache
    cache.set(cacheKey, vault, cacheTTL.vaultData);

    return {
      content: [{ type: 'text', text: JSON.stringify(vault, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}
```

### MCP Tool Definition

```typescript
export const getVaultDataTool = {
  name: 'get_vault_data',
  description: 'Get comprehensive data for a specific vault by address and chain ID. Returns vault details including TVL, asset info, curators, integrator, and current state. Data is cached for 15 minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      vaultAddress: {
        type: 'string',
        description: 'Ethereum address of the vault (0x... format, 40 hex characters)',
      },
      chainId: {
        type: 'number',
        description: 'Chain ID where the vault is deployed (e.g., 1 for Ethereum, 42161 for Arbitrum)',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific fields to return (future enhancement)',
      },
    },
    required: ['vaultAddress', 'chainId'],
  },
  handler: getVaultData,
};
```

### Example Usage

**Input**:
```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161
}
```

**Output** (truncated):
```json
{
  "id": "vault-arbitrum-0x1234",
  "address": "0x1234567890123456789012345678901234567890",
  "symbol": "lgUSDC",
  "name": "Lagoon USDC Vault",
  "state": {
    "totalAssetsUsd": 5000000,
    "totalSharesIssued": "4950000000000"
  },
  "chain": {
    "name": "Arbitrum",
    "nativeToken": "ETH"
  },
  "asset": {
    "symbol": "USDC",
    "decimals": 6
  }
}
```

### Error Handling

- **Invalid Address**: Validation error
- **Vault Not Found**: GraphQL error with message
- **Network Error**: Connection timeout
- **Cache Error**: Logged, continues with fetch

---

## Tool 3: `get_user_portfolio`

### Purpose
User holdings aggregation across one or multiple chains with total USD value.

### Complexity
MEDIUM - Multi-chain queries, aggregation logic

### Caching
YES - 5 minutes TTL, key: `portfolio:{address}:{chainIds}`

### Input Schema

```typescript
interface GetUserPortfolioInput {
  userAddress: string;        // Wallet address
  chainIds?: number[];        // Optional: specific chains, defaults to all
}
```

**Zod Validation**:
```typescript
const GetUserPortfolioInputSchema = z.object({
  userAddress: ethereumAddressSchema,
  chainIds: z.array(chainIdSchema).optional(),
});
```

### Output Schema

```typescript
interface GetUserPortfolioOutput {
  totalValueUsd: number;      // Aggregated across all chains
  positions: VaultPosition[]; // All vault positions
}

type VaultPosition = {
  id: string;
  vault: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    chain: {
      name: string;
    };
  };
  state: {
    sharesAmount: string;     // BigInt as string
    assetsValue: number;
    assetsUsd: number;
  };
};
```

### GraphQL Query

```graphql
query GetUserPortfolio($address: Address!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    id
    address
    chainId
    vaultPositions {
      id
      vault {
        id
        address
        symbol
        name
        chain {
          id
          name
        }
      }
      state {
        sharesAmount
        assetsValue
        assetsUsd
      }
    }
    state {
      totalSharesUsd
    }
  }
}
```

### Implementation

```typescript
const DEFAULT_CHAIN_IDS = [1, 42161, 10, 8453, 137]; // Ethereum, Arbitrum, Optimism, Base, Polygon

export async function getUserPortfolio(input: unknown) {
  try {
    const validated = GetUserPortfolioInputSchema.parse(input);
    const { userAddress, chainIds = DEFAULT_CHAIN_IDS } = validated;

    // Check cache
    const cacheKey = cacheKeys.userPortfolio(userAddress, chainIds);
    const cached = cache.get<GetUserPortfolioOutput>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        isError: false,
      };
    }

    // Query each chain in parallel
    const results = await Promise.all(
      chainIds.map(async (chainId) => {
        try {
          const data = await graphqlClient.request(GET_USER_PORTFOLIO_QUERY, {
            address: userAddress,
            chainId,
          });
          return data.userByAddress;
        } catch (error) {
          // User might not exist on this chain
          return null;
        }
      })
    );

    // Aggregate results
    const allPositions = results
      .filter(Boolean)
      .flatMap((user) => user.vaultPositions);

    const totalValueUsd = results
      .filter(Boolean)
      .reduce((sum, user) => sum + (user.state.totalSharesUsd || 0), 0);

    const portfolio = {
      totalValueUsd,
      positions: allPositions,
    };

    // Store in cache
    cache.set(cacheKey, portfolio, cacheTTL.userPortfolio);

    return {
      content: [{ type: 'text', text: JSON.stringify(portfolio, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}
```

### MCP Tool Definition

```typescript
export const getUserPortfolioTool = {
  name: 'get_user_portfolio',
  description: 'Get complete portfolio for a user wallet address across chains. Returns all vault positions with USD values and total portfolio value. Queries multiple chains in parallel. Data is cached for 5 minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      userAddress: {
        type: 'string',
        description: 'Wallet address (0x... format)',
      },
      chainIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional: specific chain IDs to query. If omitted, queries all major chains (Ethereum, Arbitrum, Optimism, Base, Polygon)',
      },
    },
    required: ['userAddress'],
  },
  handler: getUserPortfolio,
};
```

### Example Usage

**Input**:
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chainIds": [42161, 8453]
}
```

**Output**:
```json
{
  "totalValueUsd": 125430.50,
  "positions": [
    {
      "id": "pos-1",
      "vault": {
        "symbol": "lgUSDC",
        "name": "Lagoon USDC Vault",
        "chain": { "name": "Arbitrum" }
      },
      "state": {
        "sharesAmount": "49800000000",
        "assetsValue": 50000,
        "assetsUsd": 50000
      }
    },
    {
      "id": "pos-2",
      "vault": {
        "symbol": "lgETH",
        "name": "Lagoon ETH Vault",
        "chain": { "name": "Base" }
      },
      "state": {
        "sharesAmount": "23400000000000000",
        "assetsValue": 23.4,
        "assetsUsd": 75430.50
      }
    }
  ]
}
```

---

## Tool 4: `search_vaults`

### Purpose
Vault discovery and filtering with advanced search capabilities and pagination.

### Complexity
MEDIUM - Filter translation, pagination, caching with hash

### Caching
YES - 10 minutes TTL, key: `search:{hash(filters)}`

### Input Schema

```typescript
interface SearchVaultsInput {
  filters?: {
    assetSymbol?: string;     // e.g., "USDC"
    chainId?: number;         // e.g., 42161
    minTvl?: number;          // Minimum TVL in USD
    maxTvl?: number;          // Maximum TVL in USD
    curatorIds?: string[];    // Filter by curator IDs
    isVisible?: boolean;      // Only visible vaults
  };
  pagination?: {
    first?: number;           // Limit (default 100, max 1000)
    skip?: number;            // Offset (default 0)
  };
  orderBy?: string;           // Sort field (default "totalAssetsUsd")
  orderDirection?: 'asc' | 'desc';  // Sort direction (default "desc")
}
```

**Zod Validation**:
```typescript
const SearchVaultsInputSchema = z.object({
  filters: z.object({
    assetSymbol: z.string().optional(),
    chainId: chainIdSchema.optional(),
    minTvl: z.number().positive().optional(),
    maxTvl: z.number().positive().optional(),
    curatorIds: z.array(z.string()).optional(),
    isVisible: z.boolean().optional(),
  }).optional(),
  pagination: z.object({
    first: z.number().int().positive().max(1000).default(100),
    skip: z.number().int().nonnegative().default(0),
  }).optional(),
  orderBy: z.string().default('totalAssetsUsd'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});
```

### Output Schema

```typescript
interface SearchVaultsOutput {
  vaults: Vault[];            // Array of matching vaults
  total: number;              // Total matching (for pagination)
  hasMore: boolean;           // Whether more results exist
}
```

### GraphQL Query

```graphql
query SearchVaults(
  $first: Int!,
  $skip: Int!,
  $orderBy: VaultOrderBy!,
  $orderDirection: OrderDirection!,
  $where: VaultFilter
) {
  vaults(
    first: $first,
    skip: $skip,
    orderBy: $orderBy,
    orderDirection: $orderDirection,
    where: $where
  ) {
    items {
      id
      address
      symbol
      name
      description
      decimals
      isVisible
      state {
        totalAssetsUsd
        totalSharesIssued
      }
      chain {
        id
        name
        nativeToken
      }
      asset {
        id
        symbol
        decimals
      }
      curators {
        id
        name
      }
      integrator {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

### Filter Translation

```typescript
function buildWhereClause(filters?: SearchVaultsInput['filters']) {
  if (!filters) return undefined;

  const where: any = {};

  if (filters.assetSymbol) {
    where.assetSymbol_eq = filters.assetSymbol;
  }

  if (filters.chainId) {
    where.chainId_eq = filters.chainId;
  }

  if (filters.minTvl) {
    where.state_totalAssetsUsd_gte = filters.minTvl;
  }

  if (filters.maxTvl) {
    where.state_totalAssetsUsd_lte = filters.maxTvl;
  }

  if (filters.curatorIds) {
    where.curatorIds_contains_any = filters.curatorIds;
  }

  if (filters.isVisible !== undefined) {
    where.isVisible_eq = filters.isVisible;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}
```

### Implementation

```typescript
export async function searchVaults(input: unknown) {
  try {
    const validated = SearchVaultsInputSchema.parse(input);
    const {
      filters,
      pagination = { first: 100, skip: 0 },
      orderBy = 'totalAssetsUsd',
      orderDirection = 'desc',
    } = validated;

    // Check cache
    const cacheKey = cacheKeys.searchVaults({
      filters,
      pagination,
      orderBy,
      orderDirection,
    });
    const cached = cache.get<SearchVaultsOutput>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        isError: false,
      };
    }

    // Build where clause
    const where = buildWhereClause(filters);

    // Execute query
    const data = await graphqlClient.request(SEARCH_VAULTS_QUERY, {
      first: pagination.first,
      skip: pagination.skip,
      orderBy,
      orderDirection,
      where,
    });

    const result = {
      vaults: data.vaults.items,
      total: data.vaults.items.length,
      hasMore: data.vaults.pageInfo.hasNextPage,
    };

    // Store in cache
    cache.set(cacheKey, result, cacheTTL.searchResults);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}
```

### MCP Tool Definition

```typescript
export const searchVaultsTool = {
  name: 'search_vaults',
  description: 'Search and filter vaults with advanced options. Supports filtering by asset, chain, TVL range, curators, and visibility. Results are paginated and can be sorted. Data is cached for 10 minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      filters: {
        type: 'object',
        properties: {
          assetSymbol: { type: 'string', description: 'Filter by asset symbol (e.g., "USDC")' },
          chainId: { type: 'number', description: 'Filter by chain ID (e.g., 42161 for Arbitrum)' },
          minTvl: { type: 'number', description: 'Minimum TVL in USD' },
          maxTvl: { type: 'number', description: 'Maximum TVL in USD' },
          curatorIds: { type: 'array', items: { type: 'string' }, description: 'Filter by curator IDs' },
          isVisible: { type: 'boolean', description: 'Only visible vaults' },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          first: { type: 'number', description: 'Limit (default 100, max 1000)' },
          skip: { type: 'number', description: 'Offset (default 0)' },
        },
      },
      orderBy: { type: 'string', description: 'Sort field (default "totalAssetsUsd")' },
      orderDirection: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction (default "desc")' },
    },
  },
  handler: searchVaults,
};
```

### Example Usage

**Input**:
```json
{
  "filters": {
    "assetSymbol": "USDC",
    "chainId": 42161,
    "minTvl": 1000000,
    "isVisible": true
  },
  "pagination": {
    "first": 10,
    "skip": 0
  }
}
```

**Output** (truncated):
```json
{
  "vaults": [
    {
      "symbol": "lgUSDC",
      "name": "Lagoon USDC Vault",
      "state": { "totalAssetsUsd": 5000000 },
      "chain": { "name": "Arbitrum" },
      "asset": { "symbol": "USDC" }
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

## Tool 5: `get_vault_performance`

### Purpose
Historical metrics and trend analysis for vaults over specified time ranges.

### Complexity
HIGH - Time-series queries, aggregation, performance calculations

### Caching
YES - 30 minutes TTL, key: `perf:{address}:{chainId}:{timeRange}`

### Input Schema

```typescript
interface GetVaultPerformanceInput {
  vaultAddress: string;       // Vault address
  chainId: number;            // Chain ID
  timeRange: '7d' | '30d' | '90d' | '1y';  // Time range
}
```

**Zod Validation**:
```typescript
const GetVaultPerformanceInputSchema = z.object({
  vaultAddress: ethereumAddressSchema,
  chainId: chainIdSchema,
  timeRange: z.enum(['7d', '30d', '90d', '1y']),
});
```

### Output Schema

```typescript
interface GetVaultPerformanceOutput {
  vault: Vault;               // Vault basic info
  metrics: Array<{
    timestamp: number;        // Unix timestamp
    totalAssetsUsd: number;   // TVL at this point
    transactions: Transaction[];  // Transactions in this period
  }>;
  summary: {
    startValue: number;       // TVL at start
    endValue: number;         // TVL at end
    percentChange: number;    // % change
    volumeUsd: number;        // Total volume
    transactionCount: number; // Total transactions
  };
}
```

### GraphQL Queries

```graphql
# Get vault info
query GetVault($address: Address!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    id
    symbol
    name
  }
}

# Get transaction history
query GetVaultTransactions(
  $vaultId: ID!,
  $timestampGte: BigInt!,
  $first: Int!
) {
  transactions(
    where: {
      vaultId_eq: $vaultId,
      timestamp_gte: $timestampGte,
      type_in: ["TotalAssetsUpdated", "DepositSync", "RedeemRequest"]
    },
    orderBy: "timestamp",
    orderDirection: "asc",
    first: $first
  ) {
    items {
      id
      type
      timestamp
      blockNumber
      hash
      data {
        ... on TotalAssetsUpdatedData {
          totalAssetsUsd
          totalAssets
        }
        ... on DepositSyncData {
          shares
          assets
        }
        ... on RedeemRequestData {
          shares
          assets
        }
      }
    }
  }
}
```

### Implementation

```typescript
const TIME_RANGES = {
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
};

export async function getVaultPerformance(input: unknown) {
  try {
    const validated = GetVaultPerformanceInputSchema.parse(input);
    const { vaultAddress, chainId, timeRange } = validated;

    // Check cache
    const cacheKey = cacheKeys.vaultPerformance(vaultAddress, chainId, timeRange);
    const cached = cache.get<GetVaultPerformanceOutput>(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        isError: false,
      };
    }

    // Get vault info
    const vaultData = await graphqlClient.request(GET_VAULT_QUERY, {
      address: vaultAddress,
      chainId,
    });
    const vault = vaultData.vaultByAddress;

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const timestampGte = String(now - TIME_RANGES[timeRange]);

    // Get transaction history
    const txData = await graphqlClient.request(GET_VAULT_TRANSACTIONS_QUERY, {
      vaultId: vault.id,
      timestampGte,
      first: 1000,
    });

    // Aggregate metrics
    const transactions = txData.transactions.items;
    const metrics = aggregateMetrics(transactions);
    const summary = calculateSummary(transactions);

    const result = {
      vault,
      metrics,
      summary,
    };

    // Store in cache
    cache.set(cacheKey, result, cacheTTL.performance);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return errorResponse(error);
  }
}

function aggregateMetrics(transactions: Transaction[]) {
  // Group by day/week depending on time range
  // Return time-series array
  return [];
}

function calculateSummary(transactions: Transaction[]) {
  const tvlUpdates = transactions.filter(
    (tx) => tx.type === 'TotalAssetsUpdated'
  );

  if (tvlUpdates.length === 0) {
    return {
      startValue: 0,
      endValue: 0,
      percentChange: 0,
      volumeUsd: 0,
      transactionCount: 0,
    };
  }

  const startValue = tvlUpdates[0].data.totalAssetsUsd;
  const endValue = tvlUpdates[tvlUpdates.length - 1].data.totalAssetsUsd;
  const percentChange = ((endValue - startValue) / startValue) * 100;

  return {
    startValue,
    endValue,
    percentChange,
    volumeUsd: 0, // Calculate from deposits/withdrawals
    transactionCount: transactions.length,
  };
}
```

### MCP Tool Definition

```typescript
export const getVaultPerformanceTool = {
  name: 'get_vault_performance',
  description: 'Get historical performance metrics for a vault over a specified time range. Returns time-series data with TVL changes, transaction history, and performance summary. Data is cached for 30 minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      vaultAddress: {
        type: 'string',
        description: 'Vault address (0x... format)',
      },
      chainId: {
        type: 'number',
        description: 'Chain ID',
      },
      timeRange: {
        type: 'string',
        enum: ['7d', '30d', '90d', '1y'],
        description: 'Time range for analysis (7 days, 30 days, 90 days, or 1 year)',
      },
    },
    required: ['vaultAddress', 'chainId', 'timeRange'],
  },
  handler: getVaultPerformance,
};
```

### Example Usage

**Input**:
```json
{
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "chainId": 42161,
  "timeRange": "30d"
}
```

**Output** (truncated):
```json
{
  "vault": {
    "symbol": "lgUSDC",
    "name": "Lagoon USDC Vault"
  },
  "metrics": [
    {
      "timestamp": 1704067200,
      "totalAssetsUsd": 4500000,
      "transactions": []
    },
    {
      "timestamp": 1704153600,
      "totalAssetsUsd": 4750000,
      "transactions": []
    }
  ],
  "summary": {
    "startValue": 4500000,
    "endValue": 5000000,
    "percentChange": 11.11,
    "volumeUsd": 500000,
    "transactionCount": 45
  }
}
```

---

## Testing Requirements

Each tool must have:

1. **Unit Tests**:
   - Valid input execution
   - Input validation (invalid addresses, negative numbers, etc.)
   - Cache hit/miss scenarios
   - GraphQL error handling
   - Network error handling

2. **Integration Tests**:
   - Real backend connection
   - End-to-end execution
   - Performance benchmarks

3. **Edge Cases**:
   - Empty results
   - Very large results (pagination)
   - Timeout scenarios
   - Malformed responses

---

## Summary

| Tool | Complexity | Caching | Primary Use Case |
|------|-----------|---------|------------------|
| query_graphql | LOW | NO | Advanced/custom queries |
| get_vault_data | MEDIUM | 15min | Vault details lookup |
| get_user_portfolio | MEDIUM | 5min | Portfolio analysis |
| search_vaults | MEDIUM | 10min | Vault discovery |
| get_vault_performance | HIGH | 30min | Historical analysis |

All tools follow consistent patterns for validation, caching, error handling, and response formatting.
