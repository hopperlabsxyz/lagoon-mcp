/**
 * deposit_status Tool
 *
 * Where each deposit stands: requested (waiting for settlement), claimable,
 * claimed, or synced (instant). Follows the transaction hashes returned by the
 * wallet, or the account's latest request in a vault.
 * Spec: docs/specs/deposit.md
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { depositStatus } from '../deposit/status.js';
import type { DepositStatusInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';

export function createExecuteDepositStatus(
  _container: ServiceContainer
): (input: DepositStatusInput) => Promise<CallToolResult> {
  return async (input) => {
    try {
      const output = await depositStatus(input);
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>,
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  };
}
