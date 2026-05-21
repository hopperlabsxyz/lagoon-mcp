/**
 * get_historical_state Tool
 *
 * Returns the vault's `HistoricalVaultState` at a specific Unix timestamp
 * via `Vault.stateAt(timestamp)`. Far simpler than reconstructing state from
 * the event stream.
 *
 * Use cases:
 * - "What was the price per share on date X?"
 * - "What were the fees at vault inception vs today?"
 * - "Was the vault paused at the time of incident Y?"
 *
 * Cache: cacheTTL.historicalState (60 minutes — historical state by
 * timestamp is immutable once past).
 *
 * Cache tag: vault-adjacent. Registered under CacheTag.VAULT.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetHistoricalStateInput } from '../utils/validators.js';
import { getToolDisclaimer } from '../utils/disclaimers.js';
import { GET_HISTORICAL_STATE_QUERY } from '../graphql/queries/index.js';
import { executeToolWithCache } from '../utils/execute-tool-with-cache.js';
import { ServiceContainer } from '../core/container.js';
import { CacheTag } from '../core/cache-invalidation.js';
import { cacheTTL } from '../cache/index.js';

interface HistoricalStateResponse {
  vaultByAddress: {
    address: string;
    stateAt: Record<string, unknown> | null;
  } | null;
}

interface HistoricalStateVariables {
  address: string;
  chainId: number;
  timestamp: number;
}

function cacheKeyFor(input: GetHistoricalStateInput): string {
  return `historical_state:${input.vaultAddress}:${input.chainId}:${input.timestamp}`;
}

export function createExecuteGetHistoricalState(
  container: ServiceContainer
): (input: GetHistoricalStateInput) => Promise<CallToolResult> {
  const executor = executeToolWithCache<
    GetHistoricalStateInput,
    HistoricalStateResponse,
    HistoricalStateVariables,
    HistoricalStateResponse
  >({
    container,
    cacheKey: cacheKeyFor,
    cacheTTL: cacheTTL.historicalState,
    query: GET_HISTORICAL_STATE_QUERY,
    variables: (input) => ({
      address: input.vaultAddress,
      chainId: input.chainId,
      timestamp: input.timestamp,
    }),
    validateResult: (data) => {
      if (!data.vaultByAddress) {
        return {
          valid: false,
          message: 'Vault not found on the requested chain',
          isError: false,
        };
      }
      if (!data.vaultByAddress.stateAt) {
        return {
          valid: false,
          message:
            'No historical state available at the requested timestamp (vault may not have existed yet)',
          isError: false,
        };
      }
      return { valid: true };
    },
    toolName: 'get_historical_state',
  });

  return async (input: GetHistoricalStateInput): Promise<CallToolResult> => {
    container.cacheInvalidator.register(cacheKeyFor(input), [CacheTag.VAULT]);
    const result = await executor(input);
    if (!result.isError && result.content[0]?.type === 'text') {
      result.content[0].text = result.content[0].text + getToolDisclaimer('get_historical_state');
    }
    return result;
  };
}
