# Vault GraphQL Schema - Working Query Reference

**Generated:** 2025-01-04
**Updated:** 2025-11-04 (Verified against working API query)
**Purpose:** Complete schema reference for vault-data tool implementation

## Schema Status: VERIFIED ✅

This documentation reflects the **actual working GraphQL query** verified through manual testing in Claude Desktop and implemented in [src/tools/vault-data.ts](../src/tools/vault-data.ts:30-300).

## Working Query Structure

The query successfully retrieves vault data using:
```graphql
query GetVaultData($address: Address!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    # Full implementation in src/tools/vault-data.ts
  }
}
```

## Complete Field Reference

### Root Level Fields (NO `id`, NO `inception`)
```graphql
address: String!           # Vault contract address
symbol: String             # Vault share symbol
name: String               # Vault name
description: String        # Detailed description
shortDescription: String   # Brief summary
decimals: Int              # Share decimals
logoUrl: String            # Vault logo URL
maxCapacity: String        # Maximum deposit capacity
averageSettlement: Float   # Average settlement time (hours)
isVisible: Boolean!        # Visibility in frontend
```

### Chain Relationship (NO `id`, NO `isVisible`)
```graphql
chain: {
  name: String!            # Chain name (e.g., "Ethereum")
  nativeToken: String!     # Native token symbol (e.g., "ETH")
  factory: String!         # Factory contract address
  logoUrl: String!         # Chain logo URL
  wrappedNativeToken: {
    address: String!       # Wrapped token address
    symbol: String!        # Wrapped token symbol (e.g., "WETH")
    name: String!          # Wrapped token name
    decimals: Int!         # Wrapped token decimals
  }
}
```

### Asset Relationship (WITH `priceSources`)
```graphql
asset: {
  id: ID!                  # Asset ID
  address: String!         # Asset contract address
  symbol: String!          # Asset symbol (e.g., "USDC")
  name: String!            # Asset name
  decimals: Int!           # Asset decimals
  description: String      # Asset description
  logoUrl: String          # Asset logo URL
  isVisible: Boolean!      # Asset visibility
  priceUsd: Float!         # Current price in USD
  chain: {
    id: ID!                # Chain ID
    name: String!          # Chain name
    nativeToken: String!   # Native token
    logoUrl: String!       # Chain logo
  }
  priceSources: {
    chainlinkPriceFeed: {
      address: String!     # Price feed address
      chainId: Int!        # Price feed chain ID
    } | null
  }
}
```

### State Object (WITH `roles`, `pendingSettlement`, `newTotalAssets`)
```graphql
state: {
  state: String!           # Vault state (e.g., "ACTIVE")

  # Assets and shares
  totalAssets: String!     # Total assets in vault (BigInt)
  totalAssetsUsd: Float!   # Total assets in USD
  totalSupply: String!     # Total shares issued (BigInt)
  newTotalAssets: String!  # New total assets calculation

  # Pricing
  pricePerShare: String!   # Price per share (BigInt)
  pricePerShareUsd: Float! # Price per share in USD

  # Balances
  safeAssetBalance: String!    # Safe asset balance (BigInt)
  safeAssetBalanceUsd: Float!  # Safe asset balance USD

  # Pending operations
  pendingSettlement: {
    assets: String!        # Pending assets (BigInt)
    assetsUsd: Float!      # Pending assets USD
  }
  pendingSiloBalances: {
    assets: String!        # Pending silo assets (BigInt)
    shares: String!        # Pending silo shares (BigInt)
  }

  # Live APR (uses netApr/grossApr)
  liveAPR: {
    grossApr: Float!       # Gross APR value
    name: String!          # APR name/description
    netApr: Float!         # Net APR value
    description: String!   # APR description
  } | null

  # APR Breakdowns (full breakdown structure)
  inceptionApr: APRBreakdown!
  weeklyApr: APRBreakdown!
  monthlyApr: APRBreakdown!
  yearlyApr: APRBreakdown!

  # Roles (WITH feeReceiver)
  roles: {
    owner: String!              # Owner address
    valuationManager: String!   # Valuation manager address
    whitelistManager: String!   # Whitelist manager address
    safe: String!               # Safe address
    feeReceiver: String!        # Fee receiver address
  }

  # Fees
  managementFee: Float!    # Management fee percentage
  performanceFee: Float!   # Performance fee percentage

  # State metadata (NO version)
  highWaterMark: String!   # High water mark (BigInt)
  lastFeeTime: String!     # Last fee collection time (BigInt)
}
```

### APR Breakdown Structure
```graphql
type APRBreakdown {
  linearNetApr: Float!                # Linear net APR
  linearNetAprWithoutExtraYields: Float!  # Linear net APR without extras

  airdrops: [{
    name: String!              # Airdrop name
    apr: Float!                # APR contribution
    description: String        # Description
    distributionTimestamp: String!  # Distribution time
    endTimestamp: Float!       # End timestamp
    isEstimation: Boolean!     # Is estimated
    logoUrl: String!           # Logo URL
    multiplier: String         # Multiplier value
    ppsIncrease: Float!        # PPS increase
    startTimestamp: Float!     # Start timestamp
  }]!

  incentives: [{
    name: String!              # Incentive name
    apr: Float!                # APR contribution
    aprDescription: String!    # APR description
    description: String        # Description
    endTimestamp: Float!       # End timestamp
    incentiveRate: {
      incentiveAmount: String!      # Incentive amount (BigInt)
      referenceToken: {
        id: ID!                     # Reference token ID
      }
      referenceTokenAmount: String! # Reference amount (BigInt)
    }
  }]!

  nativeYields: [{
    name: String!              # Yield name
    apr: Float!                # APR contribution
    aprDescription: String!    # APR description
    description: String        # Description
    endTimestamp: Float        # End timestamp (nullable)
    isEstimation: Boolean!     # Is estimated
    logoUrl: String!           # Logo URL
    multiplier: String         # Multiplier value
    startTimestamp: Float!     # Start timestamp
  }]!
}
```

### Curators (NO `isVisible`)
```graphql
curators: [{
  id: ID!                    # Curator ID
  name: String!              # Curator name
  aboutDescription: String   # About description
  logoUrl: String            # Curator logo URL
  url: String                # Curator website URL
}] | null
```

### Integrator (NO `id`, NO `isVisible`, WITH `aboutDescription`)
```graphql
integrator: {
  name: String!              # Integrator name
  url: String                # Integrator website URL
  logoUrl: String            # Integrator logo URL
  aboutDescription: String   # About description
} | null
```

### DeFi Integrations
```graphql
defiIntegrations: [{
  name: String!              # Integration name
  description: String!       # Description
  logoUrl: String!           # Logo URL
  link: String!              # Integration link
  type: String!              # Integration type
}] | null
```

## Critical Schema Corrections

### ❌ Fields That DON'T EXIST in Working Query
- `id` on vault root → Does NOT exist
- `inception` timestamp → Does NOT exist
- `chain.id` → Does NOT exist
- `chain.isVisible` → Does NOT exist
- Top-level `airdrops` → Only exists within APR breakdowns
- Top-level `incentives` → Only exists within APR breakdowns
- Top-level `nativeYields` → Only exists within APR breakdowns
- Top-level `referral` → Does NOT exist
- Top-level `bundles` → Does NOT exist
- `state.version` → Does NOT exist
- `curators[].isVisible` → Does NOT exist
- `integrator.id` → Does NOT exist
- `integrator.isVisible` → Does NOT exist

### ✅ Fields That DO EXIST in Working Query
- `vault.address` (root level identifier)
- `vault.chain.factory` (factory contract address)
- `vault.asset.priceSources.chainlinkPriceFeed` (price feed structure)
- `vault.state.roles.feeReceiver` (fee receiver address)
- `vault.state.newTotalAssets` (new total assets calculation)
- `vault.state.pendingSettlement` (pending settlement amounts)
- `vault.state.pendingSiloBalances` (pending silo balances)
- `vault.state.liveAPR` (uses `netApr`/`grossApr` naming)
- `vault.state.inceptionApr/weeklyApr/monthlyApr/yearlyApr` (full breakdown)
- `vault.integrator.aboutDescription` (integrator description)

## Implementation Notes

1. **Vault Identification**: Uses `address` field, no `id` field exists
2. **Chain Identification**: Chain has no `id` field in chain object
3. **APR Structure**: Complex breakdown with nested arrays for airdrops/incentives/nativeYields
4. **Live APR**: Separate structure with `netApr`/`grossApr` (different from breakdown)
5. **Financial Relationships**: Only exist within APR breakdowns, not at top level
6. **Timestamps**: No `inception` field for vault creation time
7. **Visibility**: Chain and integrator don't have `isVisible` field

## Files Updated

1. ✅ [src/tools/vault-data.ts](../src/tools/vault-data.ts:30-300) - GraphQL query
2. ✅ [src/tools/vault-data.ts](../src/tools/vault-data.ts:218-398) - TypeScript interfaces
3. ✅ [tests/tools/vault-data.test.ts](../tests/tools/vault-data.test.ts:29-214) - Mock responses
4. ✅ [tests/tools/vault-data.test.ts](../tests/tools/vault-data.test.ts:570-673) - Test assertions
5. ✅ All tests passing (20/20)
6. ✅ TypeScript compilation successful

## Verification

- **Manual Testing**: Verified in Claude Desktop with real API
- **Unit Tests**: All 20 tests passing
- **TypeScript**: No type errors
- **Schema Match**: Query matches actual API response structure
