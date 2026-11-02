/**
 * Trusted addresses and limits for deposit plans.
 *
 * These come from config, never from the indexer or the tool input (spec R4).
 */

import type { Address } from 'viem';

export interface DepositChainConfig {
  chainId: number;
  name: string;
  /** Circle's native USDC on the chain (on Arc, the 6-decimals view of the gas token) */
  usdc: Address;
  usdcDecimals: number;
  /** Gas is paid in USDC (Arc): "max" keeps a reserve and the plan checks it */
  usdcIsGas: boolean;
  /** Lagoon vault factories: `isInstance(vault)` on any of them proves a vault is Lagoon's */
  factories: Address[];
  /** Lagoon vaults deployed before the factories, with their own beacon (the indexer's `customVaults`) */
  legacyVaults: Address[];
  multicall3: Address;
  explorerUrl: string;
}

const MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11';

/**
 * Chains with Lagoon v0.6.0 vaults whose native USDC address is already
 * trusted in this codebase (the dapp's CCTP config). Factories come from
 * @lagoon-protocol/v0-core addresses (beaconProxyFactory, optinFactory);
 * legacy vaults from the indexer's `customVaults` (infrastructure shovun.config.ts).
 */
export const DEPOSIT_CHAINS: Record<number, DepositChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: [
      '0x09C8803f7Dc251f9FaAE5f56E3B91f8A6d0b70ee',
      '0x8D6f5479B14348186faE9BC7E636e947c260f9B1',
    ],
    legacyVaults: [
      '0x07ed467acd4ffd13023046968b0859781cb90d9b',
      '0x03d1ec0d01b659b89a87eabb56e4af5cb6e14bfc',
      '0xb09f761cb13baca8ec087ac476647361b6314f98',
      '0x66dcb62da5430d800a1c807822c25be17138fda8',
      '0x71652d4898de9a7dd35e472a5fe4577ec69d82f2',
      '0x8092ca384d44260ea4feaf7457b629b8dc6f88f0',
      '0x8245fd9ae99a482dfe76576dd4298f799c041d61',
      '0xc5a7884709967a51f67d2daca7451fe3b820e2e9',
    ],
    multicall3: MULTICALL3,
    explorerUrl: 'https://etherscan.io',
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: ['0xA8E0684887b9475f8942DF6a89bEBa5B25219632'],
    legacyVaults: [],
    multicall3: MULTICALL3,
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: ['0x0C0E287f6e4de685f4b44A5282A3ad4A29D05a91'],
    legacyVaults: [],
    multicall3: MULTICALL3,
    explorerUrl: 'https://polygonscan.com',
  },
  999: {
    chainId: 999,
    name: 'HyperEVM',
    usdc: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: ['0x90beB507A1BA7D64633540cbce615B574224CD84'],
    legacyVaults: [],
    multicall3: MULTICALL3,
    explorerUrl: 'https://hyperevmscan.io',
  },
  5042: {
    chainId: 5042,
    name: 'Arc',
    usdc: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
    usdcIsGas: true,
    factories: ['0xf185b0083fd2446d3742FE3f4C3175B7e306752b'],
    legacyVaults: [],
    multicall3: MULTICALL3,
    explorerUrl: 'https://explorer.arc.io',
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: [
      '0xC953Fd298FdfA8Ed0D38ee73772D3e21Bf19c61b',
      '0x6FC0F2320483fa03FBFdF626DDbAE2CC4B112b51',
    ],
    legacyVaults: [
      '0xfce2064b4221c54651b21c868064a23695e78f09',
      '0x8092ca384d44260ea4feaf7457b629b8dc6f88f0',
      '0xdc3c7b473fb67739074e3d5483a9e381d3337ac5',
      '0xb09f761cb13baca8ec087ac476647361b6314f98',
    ],
    multicall3: MULTICALL3,
    explorerUrl: 'https://basescan.org',
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdcDecimals: 6,
    usdcIsGas: false,
    // Production factories of @lagoon-protocol/v0-core (addresses.ts). Its
    // dev factory (0x29f3…) is left out: its vaults are not indexed by Lagoon,
    // and on chain it recognizes no open USDC vault the others don't.
    factories: [
      '0x58a7729125acA9e5E9C687018E66bfDd5b2D4490',
      '0x9De724B0efEe0FbA07FE21a16B9Bf9bBb5204Fb4',
    ],
    legacyVaults: [
      '0x99cd0b8b32b15922f0754fddc21323b5278c5261',
      '0x5864672c5e37e4e58c261014f8e94ee31f575d47',
      '0x7cf8cf276450bd568187fdc0b0959d30ec599853',
    ],
    multicall3: MULTICALL3,
    explorerUrl: 'https://arbiscan.io',
  },
  43114: {
    chainId: 43114,
    name: 'Avalanche',
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    usdcDecimals: 6,
    usdcIsGas: false,
    factories: [
      '0x5e231c6d030a5c0f51fa7d0f891d3f50a928c685',
      '0xC094C224ce0406BC338E00837B96aD2e265F7287',
    ],
    legacyVaults: ['0xab4ac28d10a4bc279ad073b1d74bfa0e385c010c'],
    multicall3: MULTICALL3,
    explorerUrl: 'https://snowtrace.io',
  },
};

/**
 * How a vault takes deposits, by version (checked against the contracts in
 * lagoon-v0-internal and the per-version ABIs of @lagoon-protocol/v0-core):
 * - v0.6: sync deposit when `syncMode` allows it and the NAV is valid,
 *   `previewSyncDeposit` (entry fee included), `isAllowed`, `maxCap`.
 * - v0.5: sync deposit while the NAV is valid, `convertToShares` (no entry
 *   fee), `isWhitelisted`, no cap.
 * - legacy (v0.1 to v0.4): deposit requests only, `isWhitelisted`, no cap.
 *   v0.1 and v0.2 have no `version()`: a Lagoon vault without one is legacy.
 * Every version takes `requestDeposit(assets, controller, owner)`.
 */
export type VaultFamily = 'v0.6' | 'v0.5' | 'legacy';

export const SUPPORTED_VERSIONS = 'v0.1 to v0.6';

/** The family of a vault version; undefined for a version not supported yet */
export function vaultFamily(version: string | undefined): VaultFamily | undefined {
  if (version === undefined) return 'legacy';
  if (/^v0\.6\./.test(version)) return 'v0.6';
  if (/^v0\.5\./.test(version)) return 'v0.5';
  if (/^v0\.[1-4]\./.test(version)) return 'legacy';
  return undefined;
}

/** A plan expires after this, or earlier when a sync deposit's NAV expires */
export const PLAN_TTL_MS = 30 * 60 * 1000;

/** USDC kept for gas when the user deposits "everything" (Arc pays gas in USDC) */
export const DEFAULT_GAS_RESERVE = '1';

/** Smallest deposit per vault: any amount above zero (one base unit) */
export const MIN_ALLOCATION = '0.000001';

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

/**
 * Where users review and sign a prepared deposit: the dapp's /allocate page,
 * opened with the request in `?intent=` (base64url JSON). Unset: no link.
 */
export function signUrlFor(
  intent: unknown,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const base = env.LAGOON_APP_URL?.replace(/\/+$/, '');
  if (!base) return undefined;
  const encoded = Buffer.from(JSON.stringify(intent)).toString('base64url');
  return `${base}/allocate?intent=${encoded}`;
}
