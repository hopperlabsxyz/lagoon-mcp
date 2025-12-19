/**
 * GraphQL Fragments Index
 *
 * Central export point for all GraphQL fragments and associated TypeScript types.
 * Import from this file for convenience: `import { VAULT_FRAGMENT, VaultData } from '../graphql/fragments'`
 */

// APR Breakdown Fragment
export { APR_BREAKDOWN_FRAGMENT, type APRBreakdown } from './apr-breakdown.fragment.js';

// Asset Info Fragment
export { ASSET_INFO_FRAGMENT } from './asset-info.fragment.js';

// Chain Info Fragment
export { CHAIN_INFO_FRAGMENT } from './chain-info.fragment.js';

// PageInfo Fragments
export { PAGEINFO_MINIMAL_FRAGMENT, PAGEINFO_FULL_FRAGMENT } from './pageinfo.fragment.js';

// Transaction Base Fragment
export { TRANSACTION_BASE_FRAGMENT } from './transaction-base.fragment.js';

// Vault Fragments (depends on other fragments)
export { VAULT_FRAGMENT, type VaultData } from './vault.fragment.js';
export { VAULT_LIST_FRAGMENT, type VaultListData } from './vault-list.fragment.js';
export { VAULT_SUMMARY_FRAGMENT, type VaultSummaryData } from './vault-summary.fragment.js';

// Composition Fragment - new chain-based types
export {
  type ChainComposition,
  type RawVaultComposition,
  // Legacy types (deprecated - kept for backward compatibility)
  COMPOSITION_FRAGMENT,
  type ProtocolComposition,
  type TokenComposition,
  type CompositionData,
} from './composition.fragment.js';
