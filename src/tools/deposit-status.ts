/**
 * deposit_status Tool
 *
 * Where each deposit stands: requested (waiting for settlement), claimable,
 * claimed, or synced (instant). Follows the transaction hashes returned by the
 * wallet, or the account's latest request in a vault.
 * Spec: docs/specs/deposit.md
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { firstLine } from '../deposit/chain.js';
import { depositStatus } from '../deposit/status.js';
import { createStructuredResponse } from '../utils/tool-response.js';
import type { DepositStatusInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';

export function createExecuteDepositStatus(
  _container: ServiceContainer
): (input: DepositStatusInput) => Promise<CallToolResult> {
  return async (input) => {
    try {
      return createStructuredResponse(await depositStatus(input));
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${firstLine(error, 'unknown error')}` }],
        isError: true,
      };
    }
  };
}
