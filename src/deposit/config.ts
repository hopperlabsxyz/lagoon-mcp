/**
 * Trusted addresses and limits for deposit plans.
 *
 * These come from config, never from the indexer or the tool input (spec R4).
 * Source: @lagoon-protocol/v0-core addresses (sdk-v0), verified on Arc mainnet.
 */

import type { Address } from 'viem';

export interface DepositChainConfig {
  chainId: number;
  name: string;
  /** USDC ERC-20 (on Arc, the 6-decimals view of the native gas token) */
  usdc: Address;
  usdcDecimals: number;
  /** Lagoon OptinProxyFactory: `isInstance(vault)` proves a vault is Lagoon's */
  factory: Address;
  multicall3: Address;
  explorerUrl: string;
}

export const DEPOSIT_CHAINS: Record<number, DepositChainConfig> = {
  5042: {
    chainId: 5042,
    name: 'Arc',
    usdc: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
    factory: '0xf185b0083fd2446d3742FE3f4C3175B7e306752b',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
    explorerUrl: 'https://explorer.arc.io',
  },
};

export const SUPPORTED_VAULT_VERSION = 'v0.6.0';

/** A plan expires after this, or earlier when a sync deposit's NAV expires */
export const PLAN_TTL_MS = 30 * 60 * 1000;

/** USDC kept for gas when the user deposits "everything" (Arc pays gas in USDC) */
export const DEFAULT_GAS_RESERVE = '1';

/** Smallest deposit per vault */
export const MIN_ALLOCATION = '1';

/**
 * RPC URL of a chain, from LAGOON_RPC_URLS (`{"5042":"https://…"}`).
 * A chain without an RPC URL is not supported (spec R1).
 */
export function rpcUrlFor(
  chainId: number,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const raw = env.LAGOON_RPC_URLS;
  if (!raw) return undefined;
  try {
    const urls = JSON.parse(raw) as Record<string, unknown>;
    const url = urls[String(chainId)];
    return typeof url === 'string' && url.length > 0 ? url : undefined;
  } catch {
    return undefined;
  }
}
