/**
 * get_asset Tool
 *
 * Returns ERC20 asset metadata (symbol, decimals, current USD price, chain).
 * Useful for portfolio context when the asset isn't being fetched as part of
 * a vault query (`get_vault_data` already nests asset info).
 *
 * Cache: cacheTTL.userPortfolio (5 minutes — priceUsd ticks with the market).
 *
 * Cache tag: vault-adjacent (assets back vaults). Registered under
 * CacheTag.VAULT so a vault flush also invalidates the asset price.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetAssetInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { GET_ASSET_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

interface AssetResponse {
  assetByAddress: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    description: string | null;
    logoUrl: string | null;
    isVisible: boolean;
    priceUsd: number | null;
    chain: {
      id: string;
      name: string;
      nativeToken: string;
      logoUrl: string;
    };
  } | null;
}

function cacheKeyFor(input: GetAssetInput): string {
  return `asset:${input.assetAddress}:${input.chainId}`;
}

export function createExecuteGetAsset(
  container: ServiceContainer
): (input: GetAssetInput) => Promise<CallToolResult> {
  const executor = executeToolWithCache<
    GetAssetInput,
    AssetResponse,
    { address: string; chainId: number },
    AssetResponse
  >({
    container,
    cacheKey: cacheKeyFor,
    cacheTTL: cacheTTL.userPortfolio,
    query: GET_ASSET_QUERY,
    variables: (input) => ({ address: input.assetAddress, chainId: input.chainId }),
    validateResult: (data) => ({
      valid: data.assetByAddress !== null,
      message: data.assetByAddress ? undefined : 'Asset not found on the requested chain',
      isError: false,
    }),
    toolName: 'get_asset',
  });

  return async (input: GetAssetInput): Promise<CallToolResult> => {
    container.cacheInvalidator.register(cacheKeyFor(input), [CacheTag.VAULT]);
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('get_asset');
    }
    return result;
  };
}
