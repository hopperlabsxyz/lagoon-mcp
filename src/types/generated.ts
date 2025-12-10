export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Address: { input: string; output: string; }
  BigInt: { input: string; output: string; }
  HexString: { input: any; output: any; }
};

/** Annual Percentage Rate with various calculation methods */
export type ApRs = {
  __typename?: 'APRs';
  /** List of airdrops with their respective APR contributions for the corresponding period */
  airdrops: Array<AirdropWithApr>;
  /** List of incentives with their respective APR contributions for the corresponding period */
  incentives: Array<Incentive>;
  /** Linear net APR including all rewards and after fees */
  linearNetApr?: Maybe<Scalars['Float']['output']>;
  /** Linear net APR excluding airdrops after fees */
  linearNetAprWithoutExtraYields?: Maybe<Scalars['Float']['output']>;
  /** List of native yields with their respective APR contributions for the corresponding period */
  nativeYields: Array<NativeYield>;
};

/** Represents an airdrop event with details about token distribution */
export type Airdrop = {
  __typename?: 'Airdrop';
  /** Detailed description of the yield */
  description?: Maybe<Scalars['String']['output']>;
  /** The timestamp when the airdrop campaign starts */
  distributionTimestamp: Scalars['String']['output'];
  /** End timestamp of the yield */
  endTimestamp: Scalars['Float']['output'];
  /** Whether the yield is an estimation */
  isEstimation: Scalars['Boolean']['output'];
  /** Icon of the yield */
  logoUrl: Scalars['String']['output'];
  /** Multiplier applied to the yield source calculation */
  multiplier?: Maybe<Scalars['String']['output']>;
  /** Name of the yield */
  name: Scalars['String']['output'];
  /** The airdrop share in the price per share of the vault */
  ppsIncrease: Scalars['Float']['output'];
  /** Start timestamp of the yield */
  startTimestamp: Scalars['Float']['output'];
};

/** Airdrop information with associated APR */
export type AirdropWithApr = {
  __typename?: 'AirdropWithApr';
  /** APR as a decimal value */
  apr: Scalars['Float']['output'];
  /** Detailed description of the yield */
  description?: Maybe<Scalars['String']['output']>;
  /** The timestamp when the airdrop campaign starts */
  distributionTimestamp: Scalars['String']['output'];
  /** End timestamp of the yield */
  endTimestamp: Scalars['Float']['output'];
  /** Whether the yield is an estimation */
  isEstimation: Scalars['Boolean']['output'];
  /** Icon of the yield */
  logoUrl: Scalars['String']['output'];
  /** Multiplier applied to the yield source calculation */
  multiplier?: Maybe<Scalars['String']['output']>;
  /** Name of the yield */
  name: Scalars['String']['output'];
  /** The airdrop share in the price per share of the vault */
  ppsIncrease: Scalars['Float']['output'];
  /** Start timestamp of the yield */
  startTimestamp: Scalars['Float']['output'];
};

/** A vault asset */
export type Asset = {
  __typename?: 'Asset';
  /** Contract address of the asset */
  address: Scalars['String']['output'];
  /** The network that this asset belongs to */
  chain: Chain;
  /** Number of decimal places for the asset */
  decimals: Scalars['Int']['output'];
  /** Detailed description of the asset */
  description?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the asset */
  id: Scalars['ID']['output'];
  /** Whether the asset is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** URL to the asset's logo image */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Name of the asset */
  name: Scalars['String']['output'];
  /** Current price of the asset in USD */
  priceUsd?: Maybe<Scalars['Float']['output']>;
  /** Symbol of the asset */
  symbol: Scalars['String']['output'];
};

/** Filter input for Asset */
export type AssetFilterInput = {
  /** Filter by address equal to value */
  address_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by isVisible equal to value */
  isVisible_eq?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Available fields to order Asset by */
export type AssetOrderBy =
  /** Order by address */
  | 'address'
  /** Order by chainId */
  | 'chainId'
  /** Order by id */
  | 'id'
  /** Order by name */
  | 'name'
  /** Order by symbol */
  | 'symbol';

/** The Asset paginated response */
export type AssetPage = {
  __typename?: 'AssetPage';
  /** The list of items for the current page */
  items: Array<Asset>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Current shares and assets balances of an address */
export type Balances = {
  __typename?: 'Balances';
  /** Amount of assets */
  assets: Scalars['BigInt']['output'];
  /** USD amount of assets */
  assetsUsd?: Maybe<Scalars['Float']['output']>;
  /** Amount of shares */
  shares: Scalars['BigInt']['output'];
  /** USD amount of shares */
  sharesUsd?: Maybe<Scalars['Float']['output']>;
};

/** Bundle */
export type Bundles = {
  __typename?: 'Bundles';
  /** URL to the debank bundle */
  debank: Scalars['String']['output'];
  /** URL to the octav bundle */
  octav: Scalars['String']['output'];
};

/** Represents a network with its native token and metadata */
export type Chain = {
  __typename?: 'Chain';
  /** Vault factory address */
  factory: Scalars['Address']['output'];
  /** Unique identifier of the chain */
  id: Scalars['ID']['output'];
  /** Whether the chain is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** URL pointing to the chain's logo image */
  logoUrl: Scalars['String']['output'];
  /** Name of the chain */
  name: Scalars['String']['output'];
  /** Symbol of the native token for this chain (e.g., ETH for Ethereum) */
  nativeToken: Scalars['String']['output'];
  /** Wrapped version of the native token for this chain (e.g., WETH for Ethereum) */
  wrappedNativeToken: WrappedNativeToken;
};

/** Filter input for Chain */
export type ChainFilterInput = {
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by isVisible equal to value */
  isVisible_eq?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Available fields to order Chain by */
export type ChainOrderBy =
  /** Order by id */
  | 'id'
  /** Order by name */
  | 'name'
  /** Order by nativeToken */
  | 'nativeToken';

/** The Chain paginated response */
export type ChainPage = {
  __typename?: 'ChainPage';
  /** The list of items for the current page */
  items: Array<Chain>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** A curator entity that manages vault assets */
export type Curator = {
  __typename?: 'Curator';
  /** Descriptive text about the curator */
  aboutDescription?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the curator */
  id: Scalars['ID']['output'];
  /** Whether the chain is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** Logo image URL of the curator */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Name of the curator */
  name: Scalars['String']['output'];
  /** Website URL of the curator */
  url?: Maybe<Scalars['String']['output']>;
};

/** Filter input for Curator */
export type CuratorFilterInput = {
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by isVisible equal to value */
  isVisible_eq?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Available fields to order Curator by */
export type CuratorOrderBy =
  /** Order by id */
  | 'id'
  /** Order by name */
  | 'name';

/** The Curator paginated response */
export type CuratorPage = {
  __typename?: 'CuratorPage';
  /** The list of items for the current page */
  items: Array<Curator>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Defi integration */
export type DefiIntegration = {
  __typename?: 'DefiIntegration';
  /** Description of the protocol */
  description: Scalars['String']['output'];
  /** Link to the protocol */
  link: Scalars['String']['output'];
  /** Logo URL of the protocol */
  logoUrl: Scalars['String']['output'];
  /** Name of the protocol */
  name: Scalars['String']['output'];
  /** Type of the defi integration */
  type: DefiIntegrationType;
};

/** Type of the defi integration */
export type DefiIntegrationType =
  /** Lending protocol */
  | 'LENDING'
  /** Yield protocol */
  | 'YIELD';

/** Emitted when a deposit request happens. */
export type DepositRequest = {
  __typename?: 'DepositRequest';
  /** Amount of assets deposited */
  assets: Scalars['BigInt']['output'];
  /** The USD value of the assets being deposited */
  assetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The address that will control the request */
  controller: Scalars['Address']['output'];
  /** The address from which the asset will be transfered from. */
  owner: Scalars['Address']['output'];
  /** The id of the deposit request. */
  requestId: Scalars['BigInt']['output'];
  /** The address who gave its assets. */
  sender: Scalars['Address']['output'];
  /** The vault associated with the deposit request */
  vault: Vault;
};

/** Emitted when a deposit request is canceled. */
export type DepositRequestCanceled = {
  __typename?: 'DepositRequestCanceled';
  /** The address that will control the request. */
  controller: Scalars['Address']['output'];
  /** The id of the deposit request canceled. */
  requestId: Scalars['BigInt']['output'];
  /** The vault associated with the canceled deposit request */
  vault: Vault;
};

/** Same as a 4626 Deposit event. */
export type DepositSync = {
  __typename?: 'DepositSync';
  /** Amount of assets deposited. */
  assets: Scalars['BigInt']['output'];
  /** The USD value of the assets being deposited */
  assetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The address from which the asset will be transfered from. */
  owner: Scalars['Address']['output'];
  /** Address of the transaction sender who initiated the deposit. */
  sender: Scalars['Address']['output'];
  /** Number of shares issued for the deposit. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with the deposit sync */
  vault: Vault;
};

/** Incentives from incentive programs */
export type Incentive = {
  __typename?: 'Incentive';
  /** APR of the incentive */
  apr?: Maybe<Scalars['Float']['output']>;
  /** Disclaimer of the incentive */
  aprDescription: Scalars['String']['output'];
  /** Detailed description of the yield */
  description?: Maybe<Scalars['String']['output']>;
  /** End timestamp of the incentive */
  endTimestamp?: Maybe<Scalars['Float']['output']>;
  /** Rate of the incentive */
  incentiveRate?: Maybe<IncentiveRate>;
  /** Type of the incentive */
  incentiveType: Scalars['String']['output'];
  /** Whether the yield is an estimation */
  isEstimation: Scalars['Boolean']['output'];
  /** Icon of the yield */
  logoUrl: Scalars['String']['output'];
  /** Multiplier applied to the yield source calculation */
  multiplier?: Maybe<Scalars['String']['output']>;
  /** Name of the yield */
  name: Scalars['String']['output'];
  /** Start timestamp of the yield */
  startTimestamp: Scalars['Float']['output'];
};

/** Rate system of a reward */
export type IncentiveRate = {
  __typename?: 'IncentiveRate';
  /** Amount of incentive */
  incentiveAmount: Scalars['Float']['output'];
  /** The token evaluated to compute the incentive */
  referenceToken: Asset;
  /** Amount of reference token required to obtain the amount of incentive */
  referenceTokenAmount: Scalars['Float']['output'];
};

/** A integrator entity that manages vault assets */
export type Integrator = {
  __typename?: 'Integrator';
  /** Descriptive text about the integrator */
  aboutDescription?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the integrator */
  id: Scalars['ID']['output'];
  /** Whether the chain is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** Logo image URL of the integrator */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Name of the integrator */
  name: Scalars['String']['output'];
  /** Website URL of the integrator */
  url?: Maybe<Scalars['String']['output']>;
};

/** Filter input for Integrator */
export type IntegratorFilterInput = {
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by isVisible equal to value */
  isVisible_eq?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Available fields to order Integrator by */
export type IntegratorOrderBy =
  /** Order by id */
  | 'id'
  /** Order by name */
  | 'name';

/** The Integrator paginated response */
export type IntegratorPage = {
  __typename?: 'IntegratorPage';
  /** The list of items for the current page */
  items: Array<Integrator>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Live net APR */
export type LiveApr = {
  __typename?: 'LiveAPR';
  /** Detailed description of the yield */
  description?: Maybe<Scalars['String']['output']>;
  /** Live gross APR */
  grossApr?: Maybe<Scalars['Float']['output']>;
  /** Name of the live APR */
  name?: Maybe<Scalars['String']['output']>;
  /** Live net APR */
  netApr?: Maybe<Scalars['Float']['output']>;
};

/** Native yields from underlying asset */
export type NativeYield = {
  __typename?: 'NativeYield';
  /** APR of the native yield */
  apr: Scalars['Float']['output'];
  /** Explanation of the native yield */
  aprDescription: Scalars['String']['output'];
  /** Detailed description of the yield */
  description?: Maybe<Scalars['String']['output']>;
  /** End timestamp of the yield */
  endTimestamp?: Maybe<Scalars['Float']['output']>;
  /** Whether the yield is an estimation */
  isEstimation: Scalars['Boolean']['output'];
  /** Icon of the yield */
  logoUrl: Scalars['String']['output'];
  /** Multiplier applied to the yield source calculation */
  multiplier?: Maybe<Scalars['String']['output']>;
  /** Name of the yield */
  name: Scalars['String']['output'];
  /** Start timestamp of the yield */
  startTimestamp: Scalars['Float']['output'];
};

/** Emitted when there is a new valuation proposition. */
export type NewTotalAssetsUpdated = {
  __typename?: 'NewTotalAssetsUpdated';
  /** The new total assets value. */
  totalAssets: Scalars['BigInt']['output'];
  /** The total value of all assets in the vault converted to USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The new total supply value. */
  totalSupply: Scalars['BigInt']['output'];
  /** The vault associated with the new total assets updated */
  vault: Vault;
};

/** Vault Proxy */
export type OptinProxy = {
  __typename?: 'OptinProxy';
  /** The OptinProxy's address. */
  address: Scalars['Address']['output'];
  /** The address (usually a contract) that has the authority to initiate implementation upgrades */
  proxyAdmin: Scalars['Address']['output'];
  /** Current state optin proxy */
  state: OptinProxyState;
};

/** Current state of a vault optin proxy */
export type OptinProxyState = {
  __typename?: 'OptinProxyState';
  /** The time in seconds one must wait before enforcing a new implementation, null if not applicable */
  delay: Scalars['BigInt']['output'];
  /** The current implementation address. */
  implementation: Scalars['Address']['output'];
  /** The owner of the proxy admin contract */
  upgradeAuthority?: Maybe<Scalars['Address']['output']>;
};

/** The direction to order results */
export type OrderDirection =
  /** Sort results in ascending order (A to Z, 0 to 9) */
  | 'asc'
  /** Sort results in descending order (Z to A, 9 to 0) */
  | 'desc';

/** Pagination information for paginated query results */
export type PageInfo = {
  __typename?: 'PageInfo';
  /** Number of items returned in this page */
  count: Scalars['Int']['output'];
  /** If there are some items left in the data collections */
  hasNextPage: Scalars['Boolean']['output'];
  /** If there are previous items before the current page */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** Limit used for this page (aka "first") */
  limit: Scalars['Int']['output'];
  /** Offset used for this page */
  skip: Scalars['Int']['output'];
  /** Total number of items matching the filters (across all pages) */
  totalCount: Scalars['Int']['output'];
};

/** Period summaries are not events but are piece of data that summaries key vault metrics evolution. A period being a portion of time between two updates of TotalAssets. */
export type PeriodSummary = {
  __typename?: 'PeriodSummary';
  /** The duration of the period. */
  duration: Scalars['BigInt']['output'];
  /** The amount of shares at the end of the period, meaning after the TotalAssetsUpdate and after the fee taking but before the settlements of requests. */
  netTotalSupplyAtEnd: Scalars['BigInt']['output'];
  /** The value of TotalAssets at the end of the period, meaning after the TotalAssetsUpdate but before the potential settlements of requests. */
  totalAssetsAtEnd: Scalars['BigInt']['output'];
  /** The value of TotalAssets at the beginning of the period. */
  totalAssetsAtStart: Scalars['BigInt']['output'];
  /** The amount of shares at the end of the period, meaning after the TotalAssetsUpdate but before the settlements of requests and fee taking. */
  totalSupplyAtEnd: Scalars['BigInt']['output'];
  /** The amount of shares at the beginning of the period. */
  totalSupplyAtStart: Scalars['BigInt']['output'];
  /** The vault associated with the period summary */
  vault: Vault;
};

/** If activated, the curator want to prevent users from requesting redemption */
export type PreventWithdraw = {
  __typename?: 'PreventWithdraw';
  /** Is the feature activated */
  activated: Scalars['Boolean']['output'];
  /** Description of the reason why the curator want to prevent withdraw */
  description: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Find a Asset entity by address and chain id */
  assetByAddress: Asset;
  /** Retrieve paginated list of Asset entities with optional filtering and sorting */
  assets: AssetPage;
  /** Find a single Chain entity by its unique identifier */
  chain: Chain;
  /** Retrieve paginated list of Chain entities with optional filtering and sorting */
  chains: ChainPage;
  /** Find a single Curator entity by its unique identifier */
  curator: Curator;
  /** Retrieve paginated list of Curator entities with optional filtering and sorting */
  curators: CuratorPage;
  /** Get the global TVL for all Lagoon vaults from DeFiLlama */
  getGlobalTVL: Scalars['Float']['output'];
  /** Find a single Integrator entity by its unique identifier */
  integrator: Integrator;
  /** Retrieve paginated list of Integrator entities with optional filtering and sorting */
  integrators: IntegratorPage;
  /** Retrieve paginated list of Transaction entities with optional filtering and sorting */
  transactions: TransactionPage;
  /** Find a user by their address and chain ID */
  userByAddress: User;
  /** Retrieve paginated list of User entities with optional filtering and sorting */
  users: UserPage;
  /** Find a Vault entity by address and chain id */
  vaultByAddress: Vault;
  /** Retrieve paginated list of Vault entities with optional filtering and sorting */
  vaults: VaultPage;
};


export type QueryAssetByAddressArgs = {
  address: Scalars['Address']['input'];
  chainId: Scalars['Int']['input'];
};


export type QueryAssetsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: AssetOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<AssetFilterInput>;
};


export type QueryChainArgs = {
  id: Scalars['ID']['input'];
};


export type QueryChainsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: ChainOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<ChainFilterInput>;
};


export type QueryCuratorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCuratorsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: CuratorOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<CuratorFilterInput>;
};


export type QueryIntegratorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryIntegratorsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: IntegratorOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<IntegratorFilterInput>;
};


export type QueryTransactionsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: TransactionOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<TransactionFilterInput>;
};


export type QueryUserByAddressArgs = {
  address: Scalars['Address']['input'];
  chainId: Scalars['Int']['input'];
};


export type QueryUsersArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: UserOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<UserFilterInput>;
};


export type QueryVaultByAddressArgs = {
  address: Scalars['Address']['input'];
  chainId: Scalars['Int']['input'];
};


export type QueryVaultsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: VaultOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<VaultFilterInput>;
};

/** Holds management and performance rates for the vault. */
export type Rates = {
  __typename?: 'Rates';
  /** Management fee rate in basis points. */
  managementRate: Scalars['Float']['output'];
  /** Performance fee rate in basis points. */
  performanceRate: Scalars['Float']['output'];
};

/** Emitted when the rates are updated. */
export type RatesUpdated = {
  __typename?: 'RatesUpdated';
  /** The new rates. */
  newRates: Rates;
  /** The old rates. */
  oldRates: Rates;
  /** The timestamp at which the update will take effect. */
  timestamp: Scalars['BigInt']['output'];
  /** The vault associated with this rates update */
  vault: Vault;
};

/** Emitted when a redemption request happens. */
export type RedeemRequest = {
  __typename?: 'RedeemRequest';
  /** The controller is the address that will manage the request. */
  controller: Scalars['Address']['output'];
  /** The owner of the shares. */
  owner: Scalars['Address']['output'];
  /** The request ID. It is the current redeem epoch ID. */
  requestId: Scalars['BigInt']['output'];
  /** The address to which the asset will be transfered to. */
  sender: Scalars['Address']['output'];
  /** The amount of shares to redeemed. */
  shares: Scalars['BigInt']['output'];
  /** The USD value of the shares being redeemed */
  sharesUsd?: Maybe<Scalars['Float']['output']>;
  /** The vault associated with the redeem request */
  vault: Vault;
};

/** Referral program configuration with visibility settings and commission shares */
export type Referral = {
  __typename?: 'Referral';
  /** Optional description providing additional details about the referral program */
  description?: Maybe<Scalars['String']['output']>;
  /** Commission share percentage (person being referred) */
  refereeShare: Scalars['String']['output'];
  /** Commission share percentage (person making the referral) */
  referrerShare: Scalars['String']['output'];
  /** Whether the referral program is visible and active */
  visible: Scalars['Boolean']['output'];
};

/** Vault Roles */
export type Roles = {
  __typename?: 'Roles';
  /** The address that will receive the fees generated by the vault */
  feeReceiver: Scalars['String']['output'];
  /** The vault admin */
  owner: Scalars['String']['output'];
  /** The fund custody contract address associated with this lagoon vault */
  safe: Scalars['String']['output'];
  /** The address responsible for updating the newTotalAssets value of the vault */
  valuationManager: Scalars['String']['output'];
  /** The address responsible for managing the whitelist of permissioned vaults */
  whitelistManager: Scalars['String']['output'];
};

/**
 * Emitted only when assets are deposited into the safe, in the following sequence:
 * * After the `TotalAssetsUpdated` event
 * * After fee collection occurs
 * * Before the `SettleRedeem` event (if applicable)
 *
 */
export type SettleDeposit = {
  __typename?: 'SettleDeposit';
  /** The amount of asset deposited. */
  assetsDeposited: Scalars['BigInt']['output'];
  /** The USD value of the assets being deposited */
  assetsDepositedUsd?: Maybe<Scalars['Float']['output']>;
  /** The last deposit epoch id settled. */
  epochId: Scalars['Int']['output'];
  /** Unique identifier for the related settlement data. */
  settledId: Scalars['Int']['output'];
  /** The amount of shares minted. */
  sharesMinted: Scalars['BigInt']['output'];
  /** The total assets value settled. */
  totalAssets: Scalars['BigInt']['output'];
  /** The total value of all assets in the vault converted to USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The new total supply value. */
  totalSupply: Scalars['BigInt']['output'];
  /** The vault associated with the settle deposit */
  vault: Vault;
};

/**
 * Emitted only when assets are unwind from the safe, in the following sequence:
 * * After the `TotalAssetsUpdated` event
 * * After fee collection occurs
 * * After the `SettleDeposit` event (if applicable)
 *
 */
export type SettleRedeem = {
  __typename?: 'SettleRedeem';
  /** The amount of asset withdrawed. */
  assetsWithdrawed: Scalars['BigInt']['output'];
  /** The USD value of the assets being withdrawed */
  assetsWithdrawedUsd?: Maybe<Scalars['Float']['output']>;
  /** The last redeem epoch id settled. */
  epochId: Scalars['Int']['output'];
  /** Unique identifier for the related settlement data. */
  settledId: Scalars['Int']['output'];
  /** The amount of shares burned. */
  sharesBurned: Scalars['BigInt']['output'];
  /** The total assets value settled. */
  totalAssets: Scalars['BigInt']['output'];
  /** The total value of all assets in the vault converted to USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The total supply value. */
  totalSupply: Scalars['BigInt']['output'];
  /** The vault associated with the settle settle redeem */
  vault: Vault;
};

/** The state of the vault */
export type State =
  /** The vault is closed; settlement are locked; withdrawals are guaranteed at fixed price per share */
  | 'Closed'
  /** The vault is in the process of closing; no NEW deposit (settlement) are accepted into the vault */
  | 'Closing'
  /** The vault is open for deposits and withdrawals. */
  | 'Open';

/** Emitted when vault state changes from Open -> Closing -> Close */
export type StateUpdated = {
  __typename?: 'StateUpdated';
  /** The current state of the vault */
  state: State;
  /** The vault associated with this state update. */
  vault: Vault;
};

/** Emitted before fees are taken, SettleDeposit and SettleRedeem when there is a new vault valuation settled. */
export type TotalAssetsUpdated = {
  __typename?: 'TotalAssetsUpdated';
  /** The total assets value settled before fees, deposits and redeems. */
  totalAssets: Scalars['BigInt']['output'];
  /** The total value of all assets in the vault converted to USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** The total supply value settled before fees, deposits, adn redeems */
  totalSupply: Scalars['BigInt']['output'];
  /** The vault associated with the total assets updated */
  vault: Vault;
};

/** A transaction with associated metadata and event data */
export type Transaction = {
  __typename?: 'Transaction';
  /** Block number where the transaction was included */
  blockNumber: Scalars['BigInt']['output'];
  /** Network details */
  chain: Chain;
  /** Union type representing different types of transaction that can occur, including real on-chain events and virtual ones like PeriodSummaries */
  data: TransactionData;
  /** Transaction hash in hexadecimal format (null for virtual events) */
  hash?: Maybe<Scalars['HexString']['output']>;
  /** Unique identifier for the transaction */
  id: Scalars['ID']['output'];
  /** Index of the log entry within the transaction (null for virtual events) */
  logIndex?: Maybe<Scalars['Int']['output']>;
  /** Unix timestamp when the transaction was mined */
  timestamp: Scalars['BigInt']['output'];
  /** Type of transaction or event */
  type: TransactionType;
};

/** Union type representing different types of transaction that can occur, including real on-chain events and virtual ones like PeriodSummaries */
export type TransactionData = DepositRequest | DepositRequestCanceled | DepositSync | NewTotalAssetsUpdated | PeriodSummary | RatesUpdated | RedeemRequest | SettleDeposit | SettleRedeem | StateUpdated | TotalAssetsUpdated | WhitelistUpdated;

/** Filter input for Transaction */
export type TransactionFilterInput = {
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Filter by state equal to value */
  state_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by type in array of values */
  type_in?: InputMaybe<Array<TransactionType>>;
  /** Filter by type not in array of values */
  type_not_in?: InputMaybe<Array<TransactionType>>;
  /** Filter by vault in array of values */
  vault_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by vault not in array of values */
  vault_not_in?: InputMaybe<Array<Scalars['Address']['input']>>;
};

/** Available fields to order Transaction by */
export type TransactionOrderBy =
  /** Order by blockNumber */
  | 'blockNumber'
  /** Order by chainId */
  | 'chainId'
  /** Order by id */
  | 'id'
  /** Order by timestamp */
  | 'timestamp';

/** The Transaction paginated response */
export type TransactionPage = {
  __typename?: 'TransactionPage';
  /** The list of items for the current page */
  items: Array<Transaction>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Enum representing different types of vault transactions and operations */
export type TransactionType =
  /** Emitted when a deposit request happens. */
  | 'DepositRequest'
  /** Emitted when a deposit request is canceled. */
  | 'DepositRequestCanceled'
  /** Same as a 4626 Deposit event. */
  | 'DepositSync'
  /** Emitted when the newTotalAssets variable is updated. */
  | 'NewTotalAssetsUpdated'
  /** Period summaries are not events but are piece of data that summaries key vault metrics evolution. A period being a portion of time between two updates of TotalAssets. */
  | 'PeriodSummary'
  /** Emitted when vault fee rates get updated */
  | 'RatesUpdated'
  /** Emitted when a redemption request happens. */
  | 'RedeemRequest'
  /** Emitted when there is assets deposited in the safe. */
  | 'SettleDeposit'
  /** Emitted when there assets unwind from the safe */
  | 'SettleRedeem'
  /** Emitted when vault state changes from Open -> Closing -> Close */
  | 'StateUpdated'
  /** Emitted when the totalAssets variable is updated. */
  | 'TotalAssetsUpdated'
  /** Vault states are not events but it maintains key event states. */
  | 'VaultState'
  /** Emitted when a whitelist entry is updated */
  | 'WhitelistUpdated';

/** User entity representing a vault user */
export type User = {
  __typename?: 'User';
  /** The user's address */
  address: Scalars['Address']['output'];
  /** The network this user belongs to */
  chain: Chain;
  /** User id */
  id: Scalars['ID']['output'];
  /** Current operational state and metrics of the user */
  state: UserState;
  /** User's positions into a vault */
  vaultPositions: Array<VaultPosition>;
};

/** Filter input for User */
export type UserFilterInput = {
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by user equal to value */
  user_eq?: InputMaybe<Scalars['Address']['input']>;
};

/** Available fields to order User by */
export type UserOrderBy =
  /** Order by address */
  | 'address'
  /** Order by chainId */
  | 'chainId'
  /** Order by id */
  | 'id';

/** The User paginated response */
export type UserPage = {
  __typename?: 'UserPage';
  /** The list of items for the current page */
  items: Array<User>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Current operational state and metrics of the vault position */
export type UserState = {
  __typename?: 'UserState';
  /** The total values of all user's vault shares */
  totalSharesUsd: Scalars['Float']['output'];
};

/** A vault entity that represents a Lagoon vault contract */
export type Vault = {
  __typename?: 'Vault';
  /** The address of the vault */
  address: Scalars['String']['output'];
  /** Active and past airdrops for vault participants */
  airdrops: Array<Airdrop>;
  /** The underlying asset of the vault */
  asset: Asset;
  /** Average settlement time hours */
  averageSettlement?: Maybe<Scalars['Float']['output']>;
  /** URLs of the bundles */
  bundles?: Maybe<Bundles>;
  /** The network where the vault is deployed */
  chain: Chain;
  /** List of curators associated with this vault */
  curators?: Maybe<Array<Curator>>;
  /** Number of decimal places for the vault share */
  decimals?: Maybe<Scalars['Int']['output']>;
  /** DeFi protocols that integrated Lagoon vaults */
  defiIntegrations?: Maybe<Array<DefiIntegration>>;
  /** Detailed description of the vault and its strategy */
  description?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the vault */
  id: Scalars['ID']['output'];
  /** Incentive mechanisms associated with the vault */
  incentives: Array<Incentive>;
  /** Unix timestamp of the inception date of the vault. By default it is the timestamp of the first PeriodSummary. It can be overriden by the currator, in this case, PeriodSummaries older than this value won't be used for APR computations. */
  inception?: Maybe<Scalars['Float']['output']>;
  /** DeFi protocol that integrated Lagoon vaults */
  integrator?: Maybe<Integrator>;
  /** Whether the vault is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** URL to the vault logo image */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Maximum capacity limit for deposits in the vault */
  maxCapacity?: Maybe<Scalars['String']['output']>;
  /** Name of the vault */
  name?: Maybe<Scalars['String']['output']>;
  /** Native yields associated with the vault */
  nativeYields: Array<NativeYield>;
  /** A transparent upgradeable proxy that allows opting into logic upgrades through a registry. Returns null for vaults that don't support this upgradeability pattern. */
  optinProxy?: Maybe<OptinProxy>;
  /** Prevent withdraw */
  preventWithdraw?: Maybe<PreventWithdraw>;
  /** Referral program associated with the vault */
  referral?: Maybe<Referral>;
  /** Brief summary of the vault */
  shortDescription?: Maybe<Scalars['String']['output']>;
  /** Current operational state and metrics of the vault */
  state: VaultState;
  /** The symbol of the vault share */
  symbol?: Maybe<Scalars['String']['output']>;
};

/** Filter input for Vault */
export type VaultFilterInput = {
  /** Filter by address equal to value */
  address_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by address in array of values */
  address_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by address not equal to value */
  address_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by address not in array of values */
  address_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by assetId equal to value */
  assetId_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by assetId in array of values */
  assetId_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by assetId not equal to value */
  assetId_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by assetId not in array of values */
  assetId_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by assetSymbol equal to value */
  assetSymbol_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by assetSymbol in array of values */
  assetSymbol_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by assetSymbol not equal to value */
  assetSymbol_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by assetSymbol not in array of values */
  assetSymbol_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Filter by curatorIds containing value */
  curatorIds_contains?: InputMaybe<Scalars['String']['input']>;
  /** Filter by curatorIds containing any of the values */
  curatorIds_contains_any?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by id in array of values */
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by integratorId equal to value */
  integratorId_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by integratorId in array of values */
  integratorId_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by integratorId not equal to value */
  integratorId_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by integratorId not in array of values */
  integratorId_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by isVisible equal to value */
  isVisible_eq?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by symbol equal to value */
  symbol_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by symbol in array of values */
  symbol_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by symbol not equal to value */
  symbol_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by symbol not in array of values */
  symbol_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Available fields to order Vault by */
export type VaultOrderBy =
  /** Order by address */
  | 'address'
  /** Order by chainId */
  | 'chainId'
  /** Order by id */
  | 'id'
  /** Order by totalAssetsUsd */
  | 'totalAssetsUsd';

/** The Vault paginated response */
export type VaultPage = {
  __typename?: 'VaultPage';
  /** The list of items for the current page */
  items: Array<Vault>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Entity representing a user's position inside a vault */
export type VaultPosition = {
  __typename?: 'VaultPosition';
  /** Vault position id */
  id: Scalars['ID']['output'];
  /** Current operational state and metrics of the vault position */
  state: VaultPositionState;
  /** Vault associated with this user */
  vault: Vault;
};

/** Current operational state and metrics of the vault position */
export type VaultPositionState = {
  __typename?: 'VaultPositionState';
  /** User shares in this vault converted in underlying asset */
  assets: Scalars['BigInt']['output'];
  /** User shares in this vault */
  shares: Scalars['BigInt']['output'];
  /** User shares in this vault converted to USD */
  sharesUsd?: Maybe<Scalars['Float']['output']>;
};

/** Current state and metrics of a vault including assets, supply, pricing, and performance data */
export type VaultState = {
  __typename?: 'VaultState';
  /** List of curators associated with this vault */
  curators?: Maybe<Array<Curator>>;
  /** The highest price per share ever reached, performance fees are taken when the price per share is above this value */
  highWaterMark: Scalars['BigInt']['output'];
  /** Annualized percentage returns since inception */
  inceptionApr: ApRs;
  /** Wether the whitelist is activated or not */
  isWhitelistActivated: Scalars['Boolean']['output'];
  /** The timestamp of the last fee calculation, used to compute management fees */
  lastFeeTime: Scalars['BigInt']['output'];
  /** Live APRs associated with the vault */
  liveAPR?: Maybe<LiveApr>;
  /** Management fee percentage charged by the vault */
  managementFee: Scalars['Float']['output'];
  /** Monthly annualized percentage returns */
  monthlyApr: ApRs;
  /** The new valuation proposed for the next settlement. Will return MAX_UINT_256 until a new totalAssets value is proposed or null if no valuation has ever been proposed. */
  newTotalAssets?: Maybe<Scalars['BigInt']['output']>;
  /** The shares and assets that will be settled if the settle is possible */
  pendingSettlement: Balances;
  /** The balance of the silo in assets and shares */
  pendingSiloBalances: Balances;
  /** Performance fee percentage charged on profits */
  performanceFee: Scalars['Float']['output'];
  /** Price per vault share in base units */
  pricePerShare: Scalars['BigInt']['output'];
  /** Price per vault share in USD */
  pricePerShareUsd?: Maybe<Scalars['Float']['output']>;
  /** Protocol fee percentage charged on currators fees by the protocol */
  protocolFee: Scalars['Float']['output'];
  /** Vault access control roles and permissions */
  roles: Roles;
  /** The asset amounts currenlty in the vault custody */
  safeAssetBalance: Scalars['BigInt']['output'];
  /** The USD asset amounts currenlty in the vault custody */
  safeAssetBalanceUsd?: Maybe<Scalars['Float']['output']>;
  /** The status of the vault, open, closed, or closing */
  state: State;
  /** Total assets under management in the vault */
  totalAssets: Scalars['BigInt']['output'];
  /** Total assets value in USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** Total supply of vault shares */
  totalSupply: Scalars['BigInt']['output'];
  /** Vault version */
  version: Scalars['String']['output'];
  /** Weekly annualized percentage returns */
  weeklyApr: ApRs;
  /** Whitelisted addresses, null if not applicable */
  whitelist?: Maybe<Array<Scalars['Address']['output']>>;
  /** Yearly annualized percentage returns */
  yearlyApr: ApRs;
};

/** Emitted when a whitelist entry is updated. */
export type WhitelistUpdated = {
  __typename?: 'WhitelistUpdated';
  /** The address of the account being updated. */
  account: Scalars['Address']['output'];
  /** Indicates whether the account is authorized (true) or not (false). */
  authorized: Scalars['Boolean']['output'];
  /** The vault associated with this deposit request canceled. */
  vault: Vault;
};

/** Represents a wrapped native token with its contract details and metadata */
export type WrappedNativeToken = {
  __typename?: 'WrappedNativeToken';
  /** The contract address of the token */
  address: Scalars['Address']['output'];
  /** The number of decimal places for the token */
  decimals: Scalars['Int']['output'];
  /** The name of the token */
  name: Scalars['String']['output'];
  /** The symbol of the token */
  symbol: Scalars['String']['output'];
};
