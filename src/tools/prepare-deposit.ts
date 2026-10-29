/**
 * prepare_deposit Tool
 *
 * Turns "put X USDC into these vaults" into a verified plan of transactions for
 * the user's wallet to sign. Reads the chain at one block, checks every vault,
 * builds exact approve + deposit calls and simulates them. Never signs or sends.
 * Spec: docs/specs/deposit.md
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { prepareDeposit } from '../deposit/prepare.js';
import { signUrlFor } from '../deposit/config.js';
import type { PrepareDepositInput } from '../utils/validators.js';
import { ServiceContainer } from '../core/container.js';

export function createExecutePrepareDeposit(
  _container: ServiceContainer
): (input: PrepareDepositInput) => Promise<CallToolResult> {
  return async (input) => {
    const result = await prepareDeposit(input);
    // Also on failure: the page shows the request, the user fixes it there
    const signUrl = signUrlFor(input);
    const output = signUrl ? { ...result, signUrl } : result;
    // The first content item is the bare JSON, so programmatic callers can parse it
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output as unknown as Record<string, unknown>,
      isError: false,
    };
  };
}
