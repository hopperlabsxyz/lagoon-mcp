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

// Vault Fragment (depends on other fragments)
export { VAULT_FRAGMENT, type VaultData } from './vault.fragment.js';
