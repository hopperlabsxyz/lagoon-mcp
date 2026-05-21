/**
 * get_asset Tool
 *
 * Returns ERC20 asset metadata (symbol, decimals, current USD price, chain).
 * Useful for portfolio context when the asset isn't being fetched as part of
 * a vault query (`get_vault_data` already nests asset info).
 *
 * Cache: 5 minutes — priceUsd ticks with the market.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetAssetInput } from '../utils/validators.js';
import { GET_ASSET_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
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

export function createExecuteGetAsset(
  container: ServiceContainer
): (input: GetAssetInput) => Promise<CallToolResult> {
  return executeToolWithCache<
    GetAssetInput,
    AssetResponse,
    { address: string; chainId: number },
    AssetResponse
  >({
    container,
    cacheKey: (input) => `asset:${input.assetAddress}:${input.chainId}`,
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
}
