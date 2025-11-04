/**
 * Mock GraphQL Responses
 * Fixtures for testing without requiring a live backend
 */

export const mockVault = {
  id: 'vault-1',
  address: '0x1234567890123456789012345678901234567890',
  symbol: 'lgUSDC',
  name: 'Lagoon USDC Vault',
  description: 'High-yield USDC vault',
  shortDescription: 'USDC yield strategy',
  decimals: 6,
  maxCapacity: '1000000000000',
  logoUrl: 'https://example.com/logo.png',
  isVisible: true,
  inception: 1704067200,
  state: {
    totalAssetsUsd: 1500000.5,
    totalSharesIssued: '1500000000000',
  },
  chain: {
    id: '42161',
    name: 'Arbitrum',
    nativeToken: 'ETH',
    factory: '0xfactory123',
    isVisible: true,
    logoUrl: 'https://example.com/arbitrum.png',
  },
  asset: {
    id: 'asset-usdc',
    address: '0xasset123',
    symbol: 'USDC',
    decimals: 6,
    network: 'Arbitrum',
    logoUrl: 'https://example.com/usdc.png',
  },
  curators: [
    {
      id: 'curator-1',
      name: 'Curator One',
      description: 'Professional asset manager',
      logoUrl: 'https://example.com/curator1.png',
    },
  ],
  integrator: {
    id: 'integrator-1',
    name: 'Aave',
    description: 'Decentralized lending protocol',
    logoUrl: 'https://example.com/aave.png',
  },
};

export const mockUser = {
  id: 'user-1',
  address: '0xuser1234567890123456789012345678901234567890',
  chainId: 42161,
  chain: mockVault.chain,
  vaultPositions: [
    {
      id: 'position-1',
      vault: mockVault,
      state: {
        sharesAmount: '1000000000',
        assetsValue: 1000.0,
        assetsUsd: 1000.0,
      },
    },
  ],
  state: {
    totalSharesUsd: 1000.0,
  },
};

export const mockTransaction = {
  id: 'tx-1',
  blockNumber: '123456789',
  timestamp: '1704067200',
  chainId: 42161,
  hash: '0xtxhash123456789012345678901234567890123456789012345678901234',
  logIndex: 0,
  vault: mockVault,
  type: 'TotalAssetsUpdated',
  data: {
    totalAssetsUsd: 1500000.5,
    totalAssets: '1500000000000',
  },
};

export const mockVaultsResponse = {
  vaults: {
    items: [mockVault],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
};

export const mockUsersResponse = {
  users: {
    items: [mockUser],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
};

export const mockTransactionsResponse = {
  transactions: {
    items: [mockTransaction],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
};

export const mockGlobalTVL = 25000000.0;

export const mockHealthCheckResponse = {
  status: 'ok',
  timestamp: Date.now(),
};
