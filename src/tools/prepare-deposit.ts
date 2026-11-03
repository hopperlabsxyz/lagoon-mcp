/**
 * prepare_deposit Tool
 *
 * Turns "put X USDC into these vaults" into a verified plan of transactions for
 * the user's wallet to sign. Reads the chain at one block, checks every vault,
 * builds exact approve + deposit calls and simulates them. Never signs or sends.
 * Spec: docs/specs/deposit.md
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAddress } from 'viem';
import { isVaultProblem, prepareDeposit } from '../deposit/prepare.js';
import type { Issue, PrepareDepositOutput } from '../deposit/types.js';
import { signUrlFor } from '../deposit/config.js';
import type { PrepareDepositInput } from '../utils/validators.js';
import { createStructuredResponse } from '../utils/tool-response.js';
import { ServiceContainer } from '../core/container.js';

interface ListedVault {
  address: string;
  isVisible: boolean;
  chain: { id: string };
}

const LISTING_QUERY = `
  query DepositVaultListing($where: VaultFilterInput) {
    vaults(first: 100, where: $where) {
      items { address isVisible chain { id } }
    }
  }
`;

/**
 * Warns about vaults hidden from the Lagoon app (test or private vaults,
 * per the indexer): the factory check proves Lagoon code, not a curator the
 * app lists. Arc (testnet) only has hidden test vaults. Best effort: no
 * warning when the indexer cannot be read.
 */
async function withListingWarnings(
  result: PrepareDepositOutput,
  input: PrepareDepositInput,
  container: ServiceContainer
): Promise<PrepareDepositOutput> {
  const refs = input.allocations.map((a) => a.vault);
  let items: ListedVault[];
  try {
    const data = await container.graphqlClient.request<{ vaults: { items: ListedVault[] } }>(
      LISTING_QUERY,
      {
        where: {
          address_in: refs.map((r) => getAddress(r.address)),
          chainId_in: [...new Set(refs.map((r) => r.chainId))],
        },
      }
    );
    items = data.vaults.items;
  } catch {
    return result;
  }
  const warnings: Issue[] = refs.flatMap((ref, i) => {
    const vault = items.find(
      (v) =>
        Number(v.chain.id) === ref.chainId && v.address.toLowerCase() === ref.address.toLowerCase()
    );
    return vault && !vault.isVisible
      ? [
          {
            code: 'UNLISTED_VAULT' as const,
            severity: 'warning' as const,
            message: `${ref.address} is hidden from the Lagoon app (a test or private vault): make sure the user means this vault`,
            allocationIndex: i,
          },
        ]
      : [];
  });
  if (warnings.length === 0) return result;
  return result.ok
    ? { ...result, plan: { ...result.plan, warnings: [...result.plan.warnings, ...warnings] } }
    : { ...result, issues: [...result.issues, ...warnings] };
}

export function createExecutePrepareDeposit(
  container: ServiceContainer
): (input: PrepareDepositInput) => Promise<CallToolResult> {
  return async (input) => {
    const result = await withListingWarnings(await prepareDeposit(input), input, container);
    // Also when the request needs fixing (amount, balance, no wallet): the
    // user fixes it in the app. Not when a vault itself is the problem.
    const vaultProblem = !result.ok && result.issues.some(isVaultProblem);
    const signUrl = vaultProblem ? undefined : signUrlFor(input);
    return createStructuredResponse(signUrl ? { ...result, signUrl } : result);
  };
}
