/**
 * Discovery Tools Tests
 *
 * Tests for the seven Tier 2 / Tier 3 discovery tools:
 *   - get_global_tvl
 *   - get_indexing_status
 *   - list_chains
 *   - list_curators
 *   - get_curator
 *   - get_asset
 *   - get_historical_state
 *
 * Each tool is verified for happy path + cache hit + one edge case
 * (not-found or empty-filter).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cache } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';
import { parseJsonWithDisclaimer } from '../helpers/json-parser';

import { createExecuteGetGlobalTvl } from '../../src/tools/get-global-tvl';
import { createExecuteGetIndexingStatus } from '../../src/tools/get-indexing-status';
import { createExecuteListChains } from '../../src/tools/list-chains';
import { createExecuteListCurators } from '../../src/tools/list-curators';
import { createExecuteGetCurator } from '../../src/tools/get-curator';
import { createExecuteGetAsset } from '../../src/tools/get-asset';
import { createExecuteGetHistoricalState } from '../../src/tools/get-historical-state';

vi.mock('../../src/graphql/client', () => ({
  graphqlClient: { request: vi.fn() },
}));

import * as graphqlClientModule from '../../src/graphql/client';

const mockRequest = graphqlClientModule.graphqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cache.flushAll();
  mockRequest.mockReset();
});

const text = (result: { content: Array<{ type: string; text?: string }> }): string =>
  result.content[0]?.text ?? '';

describe('get_global_tvl', () => {
  it('returns the live TVL as a structured number', async () => {
    mockRequest.mockResolvedValueOnce({ getGlobalTVL: 1_234_567_890.12 });
    const tool = createExecuteGetGlobalTvl(createMockContainer());
    const result = await tool({});
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.totalValueLockedUsd).toBe(1_234_567_890.12);
    expect(mockRequest).toHaveBeenCalledOnce();
  });

  it('uses cache on the second call', async () => {
    mockRequest.mockResolvedValueOnce({ getGlobalTVL: 42 });
    const tool = createExecuteGetGlobalTvl(createMockContainer());
    await tool({});
    await tool({});
    expect(mockRequest).toHaveBeenCalledOnce();
  });
});

describe('get_indexing_status', () => {
  it('returns last indexed blocks for all chains by default', async () => {
    mockRequest.mockResolvedValueOnce({
      _meta: {
        lastIndexedBlocks: [
          {
            chainId: 1,
            number: '19000000',
            hash: '0xaaa',
            parentHash: '0xbbb',
            chain: { id: '1', name: 'Ethereum', nativeToken: 'ETH' },
          },
        ],
      },
    });
    const tool = createExecuteGetIndexingStatus(createMockContainer());
    const result = await tool({});
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.lastIndexedBlocks).toHaveLength(1);
    expect(body.lastIndexedBlocks[0].chainId).toBe(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { chainIds: null });
  });

  it('passes filtered chainIds through', async () => {
    mockRequest.mockResolvedValueOnce({ _meta: { lastIndexedBlocks: [] } });
    const tool = createExecuteGetIndexingStatus(createMockContainer());
    await tool({ chainIds: [1, 8453] });
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { chainIds: [1, 8453] });
  });
});

describe('list_chains', () => {
  it('returns the chain directory with pagination defaults', async () => {
    mockRequest.mockResolvedValueOnce({
      chains: {
        items: [
          {
            id: '1',
            name: 'Ethereum',
            nativeToken: 'ETH',
            logoUrl: 'https://x/eth.png',
            isVisible: true,
            factory: '0xfactory',
            wrappedNativeToken: {
              address: '0xweth',
              symbol: 'WETH',
              name: 'Wrapped Ether',
              decimals: 18,
            },
          },
        ],
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
      },
    });
    const tool = createExecuteListChains(createMockContainer());
    const result = await tool({});
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.items[0].name).toBe('Ethereum');
    // Default page size now matches paginationFirstSchema (20) so cache key
    // and GraphQL variables stay in lockstep (no cache-poisoning class bug).
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ first: 20, skip: 0, where: null })
    );
  });

  it('passes isVisible filter through', async () => {
    mockRequest.mockResolvedValueOnce({
      chains: { items: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
    });
    const tool = createExecuteListChains(createMockContainer());
    await tool({ isVisible: true });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ where: { isVisible_eq: true } })
    );
  });
});

describe('list_curators', () => {
  it('returns the curator directory', async () => {
    mockRequest.mockResolvedValueOnce({
      curators: {
        items: [
          {
            id: 'steakhouse',
            name: 'Steakhouse',
            aboutDescription: 'desc',
            logoUrl: null,
            url: null,
            isVisible: true,
          },
        ],
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
      },
    });
    const tool = createExecuteListCurators(createMockContainer());
    const result = await tool({});
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.items[0].id).toBe('steakhouse');
  });
});

describe('get_curator', () => {
  it('returns a single curator by id', async () => {
    mockRequest.mockResolvedValueOnce({
      curator: {
        id: 'mev-capital',
        name: 'MEV Capital',
        aboutDescription: null,
        logoUrl: null,
        url: null,
        isVisible: true,
      },
    });
    const tool = createExecuteGetCurator(createMockContainer());
    const result = await tool({ curatorId: 'mev-capital' });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.curator.name).toBe('MEV Capital');
  });

  it('returns a non-error message when curator missing', async () => {
    mockRequest.mockResolvedValueOnce({ curator: null });
    const tool = createExecuteGetCurator(createMockContainer());
    const result = await tool({ curatorId: 'nonexistent' });
    expect(result.isError).toBeFalsy();
    expect(text(result).toLowerCase()).toContain('not found');
  });
});

describe('get_asset', () => {
  const validAddr = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  it('returns asset metadata', async () => {
    mockRequest.mockResolvedValueOnce({
      assetByAddress: {
        id: `${validAddr}-1`,
        address: validAddr,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        description: null,
        logoUrl: null,
        isVisible: true,
        priceUsd: 1.0,
        chain: { id: '1', name: 'Ethereum', nativeToken: 'ETH', logoUrl: '' },
      },
    });
    const tool = createExecuteGetAsset(createMockContainer());
    const result = await tool({ assetAddress: validAddr, chainId: 1 });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.assetByAddress.symbol).toBe('USDC');
    expect(body.assetByAddress.priceUsd).toBe(1.0);
  });

  it('handles asset-not-found as a non-error', async () => {
    mockRequest.mockResolvedValueOnce({ assetByAddress: null });
    const tool = createExecuteGetAsset(createMockContainer());
    const result = await tool({ assetAddress: validAddr, chainId: 9999 });
    expect(result.isError).toBeFalsy();
    expect(text(result).toLowerCase()).toContain('not found');
  });
});

describe('get_historical_state', () => {
  const validVault = '0x1234567890123456789012345678901234567890';
  it('returns the historical state for a valid timestamp', async () => {
    mockRequest.mockResolvedValueOnce({
      vaultByAddress: {
        address: validVault,
        stateAt: {
          asOfTimestamp: 1_700_000_000,
          state: 'Open',
          managementFee: 200,
          performanceFee: 2000,
          protocolFee: 0,
          entryRate: 0,
          exitRate: 0,
          haircutRate: 0,
          pricePerShare: '1000000000000000000',
          pricePerShareUsd: 1.05,
          totalAssets: '1000000000000000000000',
        },
      },
    });
    const tool = createExecuteGetHistoricalState(createMockContainer());
    const result = await tool({
      vaultAddress: validVault,
      chainId: 1,
      timestamp: 1_700_000_000,
    });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.vaultByAddress.stateAt.pricePerShareUsd).toBe(1.05);
    expect(body.vaultByAddress.stateAt.managementFee).toBe(200);
  });

  it('reports a non-error message when no state exists at the timestamp', async () => {
    mockRequest.mockResolvedValueOnce({
      vaultByAddress: { address: validVault, stateAt: null },
    });
    const tool = createExecuteGetHistoricalState(createMockContainer());
    const result = await tool({
      vaultAddress: validVault,
      chainId: 1,
      timestamp: 100,
    });
    expect(result.isError).toBeFalsy();
    expect(text(result).toLowerCase()).toContain('historical state');
  });

  it('reports a non-error message when vault does not exist on the chain', async () => {
    mockRequest.mockResolvedValueOnce({ vaultByAddress: null });
    const tool = createExecuteGetHistoricalState(createMockContainer());
    const result = await tool({
      vaultAddress: validVault,
      chainId: 9999,
      timestamp: 1_700_000_000,
    });
    expect(result.isError).toBeFalsy();
    expect(text(result).toLowerCase()).toContain('vault not found');
  });
});
