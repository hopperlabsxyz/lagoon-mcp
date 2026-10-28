/**
 * Output types of prepare_deposit / deposit_status.
 * See docs/specs/deposit.md (specVersion 1). Input types live in utils/validators.ts.
 */

import type { Address, Hex } from 'viem';

export interface ChainRef {
  chainId: number;
  address: Address;
}

/** Money in output: raw base units for machines, formatted for humans */
export interface Amount {
  raw: string;
  formatted: string;
  decimals: number;
  symbol: string;
}

export type IssueCode =
  | 'INVALID_INPUT'
  | 'DUPLICATE_VAULT'
  | 'BPS_SUM_INVALID'
  | 'AMOUNT_TOO_SMALL'
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_VAULT_VERSION'
  | 'UNSUPPORTED_ACCOUNT_TYPE'
  | 'CROSS_CHAIN_NOT_SUPPORTED'
  | 'NOT_A_LAGOON_VAULT'
  | 'ASSET_MISMATCH'
  | 'VAULT_NOT_OPEN'
  | 'VAULT_PAUSED'
  | 'ACCESS_DENIED'
  | 'MAX_CAP_REACHED'
  | 'PENDING_REQUEST_EXISTS'
  | 'INSUFFICIENT_BALANCE'
  | 'SIMULATION_FAILED'
  | 'STATE_UNAVAILABLE'
  | 'ASYNC_DEPOSIT'
  | 'PENDING_DEPOSIT_EXISTS'
  | 'LOW_GAS_RESERVE'
  | 'EXISTING_ALLOWANCE_USED';

export interface Issue {
  code: IssueCode;
  severity: 'error' | 'warning' | 'info';
  message: string;
  allocationIndex?: number;
  details?: Record<string, string>;
}

export type CheckCode =
  | 'VAULT_FROM_LAGOON_FACTORY'
  | 'VAULT_VERSION_SUPPORTED'
  | 'VAULT_ASSET_IS_USDC'
  | 'VAULT_NOT_PAUSED'
  | 'ACCOUNT_ALLOWED'
  | 'UNDER_MAX_CAP'
  | 'SYNC_ALLOWED'
  | 'BALANCE_SUFFICIENT'
  | 'GAS_RESERVE'
  | 'PLAN_SIMULATED';

export interface Check {
  code: CheckCode;
  target?: ChainRef;
  passed: boolean;
  observed: Record<string, string>;
  source: 'onchain' | 'indexer' | 'simulation';
}

/** One EVM call to sign. Never carries a nonce, gas or fees: the wallet sets them */
export interface EvmCall {
  type: 'evmCall';
  to: Address;
  data: Hex;
  value: string;
}

interface StepBase {
  id: string;
  chainId: number;
  dependsOn: string[];
  description: string;
  decoded: { contract: string; function: string; args: Record<string, string> };
  execution: EvmCall;
  preconditions: Array<Record<string, unknown> & { kind: string }>;
  expectedEffects: Array<Record<string, unknown> & { kind: string }>;
}

export type Step =
  | (StepBase & { kind: 'erc20.approve'; token: ChainRef; spender: Address; amount: Amount })
  | (StepBase & { kind: 'lagoon.syncDeposit'; vault: ChainRef; assets: Amount })
  | (StepBase & { kind: 'lagoon.requestDeposit'; vault: ChainRef; assets: Amount });

export interface ResolvedAllocation {
  vault: ChainRef & { name: string; version: string };
  assets: Amount;
  mode: 'sync' | 'async';
  entryRateBps: number;
  estimatedShares: Amount | null;
  sharesAvailability: 'immediate' | 'afterSettlement';
}

export interface StateAt {
  chainId: number;
  blockNumber: string;
  timestamp: string;
}

export interface PlanSimulation {
  chainId: number;
  blockNumber: string;
  success: boolean;
  calls: Array<{ stepId: string; success: boolean; gasUsed: string; error?: string }>;
}

export interface Plan {
  specVersion: '1';
  planId: string;
  contentHash: Hex;
  createdAt: string;
  validUntil: string;
  account: { address: Address; type: 'eoa' | 'safe' };
  stateAt: StateAt[];
  allocations: ResolvedAllocation[];
  steps: Step[];
  batches: Array<{ chainId: number; stepIds: string[] }>;
  checks: Check[];
  warnings: Issue[];
  summary: string;
  /** One per chain of the plan */
  simulations: PlanSimulation[];
}

export interface PlanExports {
  eip5792?: Array<{ chainId: Hex; calls: Array<{ to: Address; data: Hex; value: Hex }> }>;
  safeTxBuilder?: unknown;
}

export type PrepareDepositOutput =
  | { ok: true; plan: Plan; exports?: PlanExports }
  | { ok: false; issues: Issue[]; checks: Check[] };

export type DepositStatus =
  | 'notFound'
  | 'failed'
  | 'requested'
  | 'claimable'
  | 'claimed'
  | 'synced';

export interface DepositStatusOutput {
  stateAt: StateAt[];
  deposits: Array<{
    vault: ChainRef & { name: string };
    txHash?: Hex;
    requestId?: string;
    status: DepositStatus;
    assets: Amount;
    pending: Amount;
    claimable: Amount;
    next?: { description: string; action?: 'lagoon.claim' };
  }>;
}
