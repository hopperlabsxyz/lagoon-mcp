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
  JSONObject: { input: any; output: any; }
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
  /** Time-weighted gross APR before fees and excluding airdrops, computed from per-period total assets/supply (uses pre-fee gross supply) */
  twrrGrossAprWithoutExtraYields?: Maybe<Scalars['Float']['output']>;
  /** Time-weighted net APR including all rewards and after fees, computed from per-period total assets/supply */
  twrrNetApr?: Maybe<Scalars['Float']['output']>;
  /** Time-weighted net APR excluding airdrops after fees, computed from per-period total assets/supply */
  twrrNetAprWithoutExtraYields?: Maybe<Scalars['Float']['output']>;
};

/** Determines whether the vault enforces a whitelist (deny-by-default) or a blacklist (allow-by-default). */
export type AccessMode =
  /** Allow-by-default. Any address may interact with the vault unless it is explicitly blacklisted or hit by the external sanctions list. */
  | 'Blacklist'
  /** Deny-by-default. Only addresses present in the whitelist may interact with the vault. */
  | 'Whitelist';

/** Emitted when the owner switches the vault between whitelist and blacklist access modes. */
export type AccessModeUpdated = {
  __typename?: 'AccessModeUpdated';
  /** New access mode. */
  newMode: AccessMode;
  /** The vault whose access mode changed. */
  vault: Vault;
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

/** ERC-20 Approval event on the vault share token. */
export type Approval = {
  __typename?: 'Approval';
  /** Address that owns the shares and authorizes the allowance. */
  owner: Scalars['Address']['output'];
  /** Address authorized to spend the owner shares. */
  spender: Scalars['Address']['output'];
  /** Allowance amount, in share units. */
  value: Scalars['BigInt']['output'];
  /** The vault whose share token allowance was updated. */
  vault: Vault;
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

/** Marker event emitted once when the owner irreversibly switches the vault to async-only mode. After this, SyncMode is forced to None and cannot be re-enabled. */
export type AsyncOnlyActivated = {
  __typename?: 'AsyncOnlyActivated';
  /** The vault that was switched to async-only. */
  vault: Vault;
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

/** Emitted when a factory deploys a new beacon proxy vault. */
export type BeaconProxyDeployed = {
  __typename?: 'BeaconProxyDeployed';
  /** Address that triggered the deployment. */
  deployer: Scalars['Address']['output'];
  /** Address of the factory contract that emitted the event. */
  factoryAddress: Scalars['Address']['output'];
  /** Address of the newly deployed beacon proxy vault. */
  proxy: Scalars['Address']['output'];
  /** The newly deployed vault. */
  vault: Vault;
};

/** A timestamped BigInt value. */
export type BigIntDataPoint = {
  __typename?: 'BigIntDataPoint';
  /** Unix timestamp in seconds. */
  x: Scalars['Float']['output'];
  /** Value at timestamp x. Null when the underlying column is unset. */
  y?: Maybe<Scalars['BigInt']['output']>;
};

/** Emitted when the whitelist manager adds or removes an address from the blacklist. The blacklist is only consulted when AccessMode is Blacklist, but it can be mutated at any time. */
export type BlacklistUpdated = {
  __typename?: 'BlacklistUpdated';
  /** The account whose blacklist status changed. */
  account: Scalars['Address']['output'];
  /** True if the account was added to the blacklist, false if removed. */
  blacklisted: Scalars['Boolean']['output'];
  /** The vault whose blacklist was updated. */
  vault: Vault;
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

/** Settled deposit request awaiting finalization, expressed in assets and shares at settlement, plus the actualized asset value at the current price per share */
export type ClaimableDepositRequest = {
  __typename?: 'ClaimableDepositRequest';
  /** Amount denominated in assets at the settlement price */
  assets: Scalars['BigInt']['output'];
  /** Asset value of the locked-in shares at the current price per share (what the claim is worth today) */
  assetsActualized: Scalars['BigInt']['output'];
  /** Amount denominated in shares (locked in at settlement — this is what will be minted when finalized) */
  shares: Scalars['BigInt']['output'];
};

/** Complete vault composition data with protocol and token breakdowns */
export type CompositionData = {
  __typename?: 'CompositionData';
  /** Breakdown by protocol (e.g., Aave, Morpho, Wallet) */
  compositions: Array<ProtocolComposition>;
  /** Breakdown by token/position */
  tokenCompositions: Array<TokenComposition>;
  /** Total portfolio net worth in USD */
  totalValueInUsd?: Maybe<Scalars['Float']['output']>;
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

/** Emitted by the FeeRegistry when a per-vault protocol-rate override is set or activated. */
export type CustomRateUpdated = {
  __typename?: 'CustomRateUpdated';
  /** Whether the custom rate is currently activated for the target vault. When false, the registry default rate applies instead. */
  isActivated: Scalars['Boolean']['output'];
  /** The protocol registry that emitted this override. */
  protocolRegistry: ProtocolRegistry;
  /** Custom protocol rate applied to the target vault, in basis points (1 BPS = 0.01%). */
  rate: Scalars['Int']['output'];
  /** The target vault whose protocol rate is being overridden. */
  targetVault: Vault;
};

/** Emitted when the FeeRegistry default implementation contract is changed. */
export type DefaultLogicUpdated = {
  __typename?: 'DefaultLogicUpdated';
  /** New default logic implementation address. */
  newLogic: Scalars['Address']['output'];
  /** Previous default logic implementation address. */
  previousLogic: Scalars['Address']['output'];
  /** The protocol registry whose default logic was updated. */
  protocolRegistry: ProtocolRegistry;
};

/** Emitted when the FeeRegistry default protocol rate is changed. */
export type DefaultRateUpdated = {
  __typename?: 'DefaultRateUpdated';
  /** New default protocol rate, in basis points (1 BPS = 0.01%). */
  newRate: Scalars['BigInt']['output'];
  /** Previous default protocol rate, in basis points (1 BPS = 0.01%). */
  oldRate: Scalars['BigInt']['output'];
  /** The protocol registry whose default rate changed. */
  protocolRegistry: ProtocolRegistry;
};

/** Defi integration */
export type DefiIntegration = {
  __typename?: 'DefiIntegration';
  /** Annual fee rate in basis points (e.g., 314 = 3.14%). Only available for insurance protocols. */
  annualFee?: Maybe<Scalars['Float']['output']>;
  /** Description of the protocol */
  description: Scalars['String']['output'];
  /** Link to the protocol */
  link: Scalars['String']['output'];
  /** Logo URL of the protocol */
  logoUrl: Scalars['String']['output'];
  /** Name of the protocol */
  name: Scalars['String']['output'];
  /** Protocol key */
  protocol: Scalars['String']['output'];
  /** Type of the defi integration */
  type: DefiIntegrationType;
};

/** Type of the defi integration */
export type DefiIntegrationType =
  /** Insurance protocol */
  | 'INSURANCE'
  /** Lending protocol */
  | 'LENDING'
  /** Yield protocol */
  | 'YIELD';

/** Emitted when a user claims a previously requested and settled deposit in the ERC7540 async flow — the pending assets are converted at the settled rate and shares are minted to the owner. */
export type Deposit = {
  __typename?: 'Deposit';
  /** Amount of assets deposited. */
  assets: Scalars['BigInt']['output'];
  /** The address that receives the newly minted shares. */
  owner: Scalars['Address']['output'];
  /** The address that called `deposit` — pays the assets into the vault. */
  sender: Scalars['Address']['output'];
  /** Amount of shares minted. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with the deposit */
  vault: Vault;
};

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

/** A registered external sanctions list contract that vaults can opt into. The list contract gates access on-chain alongside any per-vault whitelist or blacklist. */
export type ExternalSanctionsList = {
  __typename?: 'ExternalSanctionsList';
  /** Address of the external sanctions list contract */
  address: Scalars['Address']['output'];
  /** EVM chain ID where the sanctions list contract is deployed */
  chainId: Scalars['Int']['output'];
  /** Whether the entry is shown to end users in the frontend selector. Public queries always filter to true; non-visible rows are not exposed. */
  isVisible: Scalars['Boolean']['output'];
  /** Human-readable name of the provider (e.g., "Chainalysis") */
  name: Scalars['String']['output'];
};

/** Filter input for ExternalSanctionsList */
export type ExternalSanctionsListFilterInput = {
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Available fields to order ExternalSanctionsList by */
export type ExternalSanctionsListOrderBy =
  /** Order by chainId */
  | 'chainId'
  /** Order by id */
  | 'id'
  /** Order by name */
  | 'name';

/** The ExternalSanctionsList paginated response */
export type ExternalSanctionsListPage = {
  __typename?: 'ExternalSanctionsListPage';
  /** The list of items for the current page */
  items: Array<ExternalSanctionsList>;
  /** Pagination information */
  pageInfo: PageInfo;
};

/** Emitted when the whitelist manager updates the external sanctions list oracle. The zero address means no external check is performed. */
export type ExternalSanctionsListUpdated = {
  __typename?: 'ExternalSanctionsListUpdated';
  /** New external sanctions list address. */
  newExternalSanctionList: Scalars['Address']['output'];
  /** Previous external sanctions list address. */
  oldExternalSanctionList: Scalars['Address']['output'];
  /** The vault whose sanctions list was updated. */
  vault: Vault;
};

/** Emitted when the owner rotates the fee-receiver address. */
export type FeeReceiverUpdated = {
  __typename?: 'FeeReceiverUpdated';
  /** New fee-receiver address. */
  newReceiver: Scalars['Address']['output'];
  /** Previous fee-receiver address. */
  oldReceiver: Scalars['Address']['output'];
  /** The vault whose fee receiver was updated. */
  vault: Vault;
};

/** Emitted every time the vault takes a fee. Carries the fee category, the total shares minted to cover the fee, the rate (BPS) that produced the amount, and the split between manager and protocol recipients. Starting with v0.6.0. */
export type FeeTaken = {
  __typename?: 'FeeTaken';
  /** The settleId of the producing settlement, or 0 when not relevant (e.g. fees charged on sync paths). */
  contextId: Scalars['Int']['output'];
  /** Which fee category was collected. */
  feeType: FeeType;
  /** Portion of the fee shares routed to the manager fee receiver. */
  managerShares: Scalars['BigInt']['output'];
  /** Portion of the fee shares routed to the protocol fee receiver. */
  protocolShares: Scalars['BigInt']['output'];
  /** Fee rate applied, expressed in basis points (1 BPS = 0.01%). */
  rate: Scalars['Int']['output'];
  /** Total shares minted to cover the fee. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with this fee. */
  vault: Vault;
};

/** Category of fee collected by the vault. Carried on FeeTaken events so clients can disambiguate which fee rate produced a given deduction. */
export type FeeType =
  /** Entry fee — charged on deposits. Deducted immediately on syncDeposit, at claim time for async deposits. */
  | 'Entry'
  /** Exit fee — charged on redemptions. Deducted immediately on syncRedeem, at claim time for async redemptions, at withdraw time for closed vaults. */
  | 'Exit'
  /** Management fee — accrues pro-rata on AUM since the last fee time. Taken during settlement. */
  | 'Management'
  /** Performance fee — charged on value appreciation above the high-water mark. Taken during settlement. */
  | 'Performance';

/** A timestamped floating point value. */
export type FloatDataPoint = {
  __typename?: 'FloatDataPoint';
  /** Unix timestamp in seconds. */
  x: Scalars['Float']['output'];
  /** Value at timestamp x. Null when the underlying column is unset. */
  y?: Maybe<Scalars['Float']['output']>;
};

/** Price-per-share evolution limits enforced. When activated, attempts to update newTotalAssets that would move PPS outside [lowerRate, upperRate] (scaled by time since the last valuation) are rejected. The security council can bypass this check via securityCouncilUpdateTotalAssets. */
export type Guardrails = {
  __typename?: 'Guardrails';
  /** Whether guardrails enforcement is currently active. When false, PPS updates bypass the [lowerRate, upperRate] check. */
  activated: Scalars['Boolean']['output'];
  /** Maximum allowed negative price-per-share drift per unit of time, expressed as a signed int256 rate in basis points per year (negative values permitted). */
  lowerRate: Scalars['BigInt']['output'];
  /** Maximum allowed positive price-per-share drift per unit of time, expressed as a uint256 rate in basis points per year. */
  upperRate: Scalars['BigInt']['output'];
};

/** Emitted when the security council enables or disables guardrails enforcement. When deactivated, PPS updates bypass the [lowerRate, upperRate] check. */
export type GuardrailsStatusUpdated = {
  __typename?: 'GuardrailsStatusUpdated';
  /** Whether guardrails enforcement is now active. */
  activated: Scalars['Boolean']['output'];
  /** The vault whose guardrails activation changed. */
  vault: Vault;
};

/** Emitted when the security council updates the price-per-share evolution limits. Rates are flattened to four BigInt fields rather than nested Guardrails objects because the activation flag lives on a separate GuardrailsStatusUpdated event. */
export type GuardrailsUpdated = {
  __typename?: 'GuardrailsUpdated';
  /** New maximum allowed negative PPS drift per unit of time. */
  newLowerRate: Scalars['BigInt']['output'];
  /** New maximum allowed positive PPS drift per unit of time. */
  newUpperRate: Scalars['BigInt']['output'];
  /** Previous maximum allowed negative PPS drift per unit of time. */
  oldLowerRate: Scalars['BigInt']['output'];
  /** Previous maximum allowed positive PPS drift per unit of time. */
  oldUpperRate: Scalars['BigInt']['output'];
  /** The vault whose guardrails were updated. */
  vault: Vault;
};

/** Emitted on syncRedeem when a haircut is taken. The deducted shares are burned — they are not routed to any fee receiver, instead they redistribute value to remaining shareholders by reducing supply faster than assets. */
export type HaircutTaken = {
  __typename?: 'HaircutTaken';
  /** Address whose shares were haircut. */
  owner: Scalars['Address']['output'];
  /** Haircut rate applied, expressed in basis points (1 BPS = 0.01%). Capped at 2000 BPS (20%). */
  rate: Scalars['Int']['output'];
  /** Amount of shares burned as haircut. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with this haircut. */
  vault: Vault;
};

/** Emitted when the high-water mark (used for performance fee accounting) is updated. */
export type HighWaterMarkUpdated = {
  __typename?: 'HighWaterMarkUpdated';
  /** New high-water mark value. */
  newHighWaterMark: Scalars['BigInt']['output'];
  /** Previous high-water mark value. */
  oldHighWaterMark: Scalars['BigInt']['output'];
  /** The vault whose high-water mark changed. */
  vault: Vault;
};

/** Point-in-time reconstruction of a vault from onchain history. State metrics (totalAssets, pricing, USD values) are nullable when the underlying history row has a null column. Config fields (fees, roles, access mode, guardrails) are always populated from the nearest config-history row at or before `asOfTimestamp`. `maxCap: null` when the vault has no cap configured (MAX_UINT_256 sentinel). Some fields (curators, pending balances, safe balance, live APR) are not available on this type yet. */
export type HistoricalVaultState = {
  __typename?: 'HistoricalVaultState';
  /** Access control mode at `asOfTimestamp` (Whitelist / Blacklist). Pre-v0.6.0 history rows report Blacklist (contract default) as there is no reliable signal in the config row to distinguish legacy from explicitly-configured Blacklist. */
  accessMode?: Maybe<AccessMode>;
  /** Whether the vault allows resetting the high water mark. Immutable, set at deploy time. Defaults to false for vaults deployed before the on-chain flag existed. */
  allowHighWaterMarkReset: Scalars['Boolean']['output'];
  /** Entry fee rate in basis points at `asOfTimestamp`. Capped at 200 BPS (2%). Applied on deposits — immediately on syncDeposit, at claim time for async. Paid to the fee receiver. */
  entryRate: Scalars['Float']['output'];
  /** Exit fee rate in basis points at `asOfTimestamp`. Capped at 200 BPS (2%). Applied on redeems — immediately on syncRedeem, at claim time for async, at withdraw time for closed vaults. Paid to the fee receiver. */
  exitRate: Scalars['Float']['output'];
  /** Address of the external sanctions list oracle configured at `asOfTimestamp`. Defaults to the zero address when unset. */
  externalSanctionsList: Scalars['String']['output'];
  /** Minimum delay (seconds) between fee rate update and enforcement at `asOfTimestamp`. */
  feeRatesCooldown?: Maybe<Scalars['BigInt']['output']>;
  /** Price-per-share guardrails configuration and activation at `asOfTimestamp`. */
  guardrails: Guardrails;
  /** Haircut fee rate in basis points at `asOfTimestamp`. Capped at 2000 BPS (20%). Applied on syncRedeem after the exit fee, on the shares remaining after exit-fee deduction. Unlike entry/exit fees, the haircut is not paid to the fee receiver — the corresponding asset value is retained by the vault. Price-per-share is unchanged at the moment of the redeem, and the retained value accrues to remaining shareholders at the next valuation update. */
  haircutRate: Scalars['Float']['output'];
  /** Highest price per share ever reached as of `asOfTimestamp`. */
  highWaterMark?: Maybe<Scalars['BigInt']['output']>;
  /** Annualized return since inception, computed from period summaries with timestamp <= `asOfTimestamp`. */
  inceptionApr?: Maybe<ApRs>;
  /** Whether the vault had been irreversibly switched to async-only mode at `asOfTimestamp`. */
  isAsyncOnly: Scalars['Boolean']['output'];
  /** Whether the whitelist was activated at `asOfTimestamp`. */
  isWhitelistActivated?: Maybe<Scalars['Boolean']['output']>;
  /** Timestamp of the last fee calculation at `asOfTimestamp`. */
  lastFeeTime?: Maybe<Scalars['BigInt']['output']>;
  /** Effective management fee at `asOfTimestamp` (applies upcoming rates if newRatesTimestamp has elapsed). */
  managementFee?: Maybe<Scalars['Float']['output']>;
  /** Maximum total assets the vault could hold at `asOfTimestamp`, in asset units. Null when no cap was configured. */
  maxCap?: Maybe<Scalars['BigInt']['output']>;
  /** Trailing 30-day APR as of `asOfTimestamp`, computed from period summaries with timestamp <= `asOfTimestamp`. */
  monthlyApr?: Maybe<ApRs>;
  /** Timestamp at which the upcoming rates become effective, as configured at `asOfTimestamp`. */
  newRatesTimestamp?: Maybe<Scalars['BigInt']['output']>;
  /** New valuation proposed for the next settlement at `asOfTimestamp`. */
  newTotalAssets?: Maybe<Scalars['BigInt']['output']>;
  /** Effective performance fee at `asOfTimestamp` (applies upcoming rates if newRatesTimestamp has elapsed). */
  performanceFee?: Maybe<Scalars['Float']['output']>;
  /** Price per vault share in base units at `asOfTimestamp`. */
  pricePerShare?: Maybe<Scalars['BigInt']['output']>;
  /** Price per vault share in USD at `asOfTimestamp`. */
  pricePerShareUsd?: Maybe<Scalars['Float']['output']>;
  /** Protocol fee at `asOfTimestamp`. */
  protocolFee?: Maybe<Scalars['Float']['output']>;
  /** Vault access control roles at `asOfTimestamp`. */
  roles: Roles;
  /** Whether updates to the safe address had been irreversibly locked at `asOfTimestamp`. Once true, the safe address can no longer be changed. Pre-v0.6.0 vaults had no mechanism to change the safe address either, so they are reported as locked (true). */
  safeLocked: Scalars['Boolean']['output'];
  /** Vault lifecycle state (Open/Closing/Closed) at `asOfTimestamp`. */
  state?: Maybe<State>;
  /** Whether updates to the super operator role had been irreversibly locked at `asOfTimestamp`. Null when not applicable — the super operator role did not exist on pre-v0.6.0 vaults. Once true, the super operator can no longer be changed. */
  superOperatorLocked?: Maybe<Scalars['Boolean']['output']>;
  /** Which synchronous operations were allowed at `asOfTimestamp` (Both, SyncDeposit, SyncRedeem, None). */
  syncMode: SyncMode;
  /** Total assets under management in the vault at `asOfTimestamp`. */
  totalAssets?: Maybe<Scalars['BigInt']['output']>;
  /** Unix timestamp after which totalAssets was considered stale (as configured at `asOfTimestamp`). */
  totalAssetsExpiration: Scalars['BigInt']['output'];
  /** Total assets value in USD at `asOfTimestamp`. */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** Total supply of vault shares at `asOfTimestamp`. */
  totalSupply?: Maybe<Scalars['BigInt']['output']>;
  /** Upcoming management fee rate at `asOfTimestamp`. */
  upcomingManagementFee?: Maybe<Scalars['Float']['output']>;
  /** Upcoming performance fee rate at `asOfTimestamp`. */
  upcomingPerformanceFee?: Maybe<Scalars['Float']['output']>;
  /** Trailing 7-day APR as of `asOfTimestamp`, computed from period summaries with timestamp <= `asOfTimestamp`. */
  weeklyApr?: Maybe<ApRs>;
  /** Trailing 365-day APR as of `asOfTimestamp`, computed from period summaries with timestamp <= `asOfTimestamp`. */
  yearlyApr?: Maybe<ApRs>;
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

/** Last block on a chain from which an indexed event was ingested. Only blocks that emit a tracked event advance this value, so on low-activity chains it may lag behind the chain head even when indexing is healthy. An hourly health-check event guarantees the value advances at least once per hour. */
export type IndexedBlock = {
  __typename?: 'IndexedBlock';
  /** Network details (null if the chain is unknown) */
  chain?: Maybe<Chain>;
  /** Chain ID */
  chainId: Scalars['Int']['output'];
  /** Block hash */
  hash: Scalars['HexString']['output'];
  /** Block number of the most recent tracked event. Not updated for blocks that produce no tracked events, so this can trail the current chain head during quiet periods — an hourly health-check event bounds the lag to ~1 hour. */
  number: Scalars['BigInt']['output'];
  /** Parent block hash */
  parentHash: Scalars['HexString']['output'];
};

/** Emitted on proxy initialization. Carries the contract version number used at initialization time — useful for audit and to correlate with implementation upgrades. */
export type Initialized = {
  __typename?: 'Initialized';
  /** The vault that was initialized. */
  vault: Vault;
  /** Contract version number at the moment of initialization. */
  version: Scalars['BigInt']['output'];
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

/** A vault logic implementation available in a protocol registry. Identified by its onchain address per chain. */
export type Logic = {
  __typename?: 'Logic';
  /** Address of the logic implementation contract */
  address: Scalars['Address']['output'];
  /** Whether this logic implementation is visible to users in the Lagoon frontend. Configured per (chainId, address) in metadata.logic_implementations; defaults to false when no row exists. */
  isVisible: Scalars['Boolean']['output'];
  /** Lagoon version of this logic implementation (e.g. "v0.5.0"). Derived from the SDK address catalog. Null if the address does not match a known release. */
  version?: Maybe<Scalars['String']['output']>;
};

/** Emitted when a new implementation contract is whitelisted in the FeeRegistry. */
export type LogicAdded = {
  __typename?: 'LogicAdded';
  /** Address of the logic implementation that was whitelisted. */
  logic: Scalars['Address']['output'];
  /** The protocol registry that emitted the event. */
  protocolRegistry: ProtocolRegistry;
};

/** Emitted when an implementation contract is removed from the FeeRegistry whitelist. */
export type LogicRemoved = {
  __typename?: 'LogicRemoved';
  /** Address of the logic implementation removed from the registry whitelist. */
  logic: Scalars['Address']['output'];
  /** The protocol registry that emitted the event. */
  protocolRegistry: ProtocolRegistry;
};

/** Emitted when the safe updates the maximum total assets the vault can hold. Enforced on syncDeposit and requestDeposit. */
export type MaxCapUpdated = {
  __typename?: 'MaxCapUpdated';
  /** New max cap in asset units. */
  maxCap: Scalars['BigInt']['output'];
  /** Previous max cap in asset units. */
  previousMaxCap: Scalars['BigInt']['output'];
  /** The vault whose max cap was updated. */
  vault: Vault;
};

/** Indexing status metadata */
export type Meta = {
  __typename?: 'Meta';
  /** Last indexed block per chain for the active integration */
  lastIndexedBlocks: Array<IndexedBlock>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Update off-chain metadata for a vault. Requires EIP-712 signature from the vault owner. */
  updateVaultMetadata: Vault;
};


export type MutationUpdateVaultMetadataArgs = {
  chainId: Scalars['Int']['input'];
  deadline: Scalars['Int']['input'];
  input: UpdateVaultMetadataInput;
  signature: Scalars['String']['input'];
  vaultAddress: Scalars['Address']['input'];
};

/** Emitted when the owner updates the ERC-20 token name. Note that wallets and explorers typically cache token metadata. */
export type NameUpdated = {
  __typename?: 'NameUpdated';
  /** New ERC-20 token name. */
  newName: Scalars['String']['output'];
  /** Previous ERC-20 token name. */
  previousName: Scalars['String']['output'];
  /** The vault whose name was updated. */
  vault: Vault;
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
  /** The vault associated with the new total assets updated */
  vault: Vault;
};

/** ERC-7540 event: a controller authorizes or revokes an operator to act on its behalf. */
export type OperatorSet = {
  __typename?: 'OperatorSet';
  /** Whether the operator is approved (true) or revoked (false) by the controller. */
  approved: Scalars['Boolean']['output'];
  /** The controller delegating execution authority (i.e. the principal granting or revoking the operator). */
  controller: Scalars['Address']['output'];
  /** The operator address being granted or revoked authorization to act on behalf of the controller. */
  operator: Scalars['Address']['output'];
  /** The vault on which the operator authorization was set. */
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

/** An owner entity that owns vault assets */
export type Owner = {
  __typename?: 'Owner';
  /** Descriptive text about the owner */
  aboutDescription?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the owner */
  id: Scalars['ID']['output'];
  /** Whether the owner is visible to users in the Lagoon frontend */
  isVisible: Scalars['Boolean']['output'];
  /** Logo image URL of the owner */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Name of the owner */
  name: Scalars['String']['output'];
  /** Website URL of the owner */
  url?: Maybe<Scalars['String']['output']>;
};

/** Emitted when ownership transfer is initiated (pending acceptance — 2-step Ownable2Step pattern). */
export type OwnershipTransferStarted = {
  __typename?: 'OwnershipTransferStarted';
  /** New owner address pending acceptance of ownership. */
  newOwner: Scalars['Address']['output'];
  /** Previous owner address (current owner initiating the transfer). */
  previousOwner: Scalars['Address']['output'];
  /** The vault whose ownership transfer was started. */
  vault: Vault;
};

/** Emitted when ownership transfer is finalized (the pending owner has accepted). */
export type OwnershipTransferred = {
  __typename?: 'OwnershipTransferred';
  /** New vault owner address. */
  newOwner: Scalars['Address']['output'];
  /** Previous vault owner address. */
  previousOwner: Scalars['Address']['output'];
  /** The vault whose ownership was transferred. */
  vault: Vault;
};

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

/** Emitted when the vault is paused (no deposits/redemptions allowed). */
export type Paused = {
  __typename?: 'Paused';
  /** Account that triggered the pause. */
  account: Scalars['Address']['output'];
  /** The vault that was paused. */
  vault: Vault;
};

/** A user's pending redeem request awaiting settlement, with whether the user can still cancel it */
export type PendingRedeemRequest = {
  __typename?: 'PendingRedeemRequest';
  /** Amount denominated in assets */
  assets: Scalars['BigInt']['output'];
  /** True when the user can still cancel this redeem request. Always false on pre-v0.6.0 vaults (cancelRedeemRequest entrypoint did not exist). The frontend should not re-derive this rule. */
  isCancelable: Scalars['Boolean']['output'];
  /** Amount denominated in shares */
  shares: Scalars['BigInt']['output'];
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

/** Emitted at vault initialization when pre-minted shares are sent to the safe. */
export type PreMint = {
  __typename?: 'PreMint';
  /** Seed assets virtually deposited into the vault. */
  assets: Scalars['BigInt']['output'];
  /** Address that receives the pre-minted shares (typically the safe). */
  receiver: Scalars['Address']['output'];
  /** Address that provided the seed assets. */
  sender: Scalars['Address']['output'];
  /** Shares minted to the receiver. */
  shares: Scalars['BigInt']['output'];
  /** The vault that emitted the pre-mint. */
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

/** Protocol allocation within a vault composition */
export type ProtocolComposition = {
  __typename?: 'ProtocolComposition';
  /** Detail breakdown for grouped items (e.g., "Other" category contains small allocations) */
  details?: Maybe<Array<ProtocolComposition>>;
  /** Protocol logo URL (from Octav) */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Name of the protocol (e.g., "Aave", "Compound", "Morpho") */
  protocol: Scalars['String']['output'];
  /** Percentage of total vault value (0-100) */
  repartition: Scalars['Float']['output'];
  /** Value deployed to this protocol in USD */
  valueInUsd: Scalars['Float']['output'];
};

/** Emitted when the FeeRegistry protocol-fee receiver is rotated. */
export type ProtocolFeeReceiverUpdated = {
  __typename?: 'ProtocolFeeReceiverUpdated';
  /** New protocol-fee receiver address. */
  newReceiver: Scalars['Address']['output'];
  /** Previous protocol-fee receiver address. */
  oldReceiver: Scalars['Address']['output'];
  /** The protocol registry whose fee receiver was rotated. */
  protocolRegistry: ProtocolRegistry;
};

/** A Lagoon protocol registry. Exposes the current onchain state derived from registry events (default logic, available logics, default rate, protocol fee receiver). */
export type ProtocolRegistry = {
  __typename?: 'ProtocolRegistry';
  /** Address of the registry contract */
  address: Scalars['Address']['output'];
  /** Set of logic implementations currently available on the registry (added but not subsequently removed). */
  availableLogics: Array<Logic>;
  /** The network where the registry is deployed. Null if the chain is not in the metadata catalog. */
  chain?: Maybe<Chain>;
  /** The current default logic implementation used by new proxies, derived from the latest DefaultLogicUpdated event. */
  defaultLogic?: Maybe<Logic>;
  /** The current default rate applied by the registry, in basis points (1 BPS = 0.01%). Derived from the latest DefaultRateUpdated event. Null if never set. */
  defaultRate?: Maybe<Scalars['Int']['output']>;
  /** The current protocol fee receiver, derived from the latest ProtocolFeeReceiverUpdated event. Null if never set. */
  protocolFeeReceiver?: Maybe<Scalars['Address']['output']>;
};

/** Emitted when a factory deploys a new vault proxy. */
export type ProxyDeployed = {
  __typename?: 'ProxyDeployed';
  /** Address that triggered the deployment. */
  deployer: Scalars['Address']['output'];
  /** Address of the factory contract that emitted the event. */
  factoryAddress: Scalars['Address']['output'];
  /** Address of the newly deployed vault proxy. */
  proxy: Scalars['Address']['output'];
  /** The newly deployed vault. */
  vault: Vault;
};

export type Query = {
  __typename?: 'Query';
  /** Indexing status metadata */
  _meta: Meta;
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
  /** Retrieve paginated list of ExternalSanctionsList entities with optional filtering and sorting */
  externalSanctionsLists: ExternalSanctionsListPage;
  /** Get the global TVL for all Lagoon vaults from DeFiLlama */
  getGlobalTVL: Scalars['Float']['output'];
  /** Find a single Integrator entity by its unique identifier */
  integrator: Integrator;
  /** Retrieve paginated list of Integrator entities with optional filtering and sorting */
  integrators: IntegratorPage;
  /** List all known Lagoon protocol registries. Optionally filter by one or more chain ids. */
  protocolRegistries: Array<ProtocolRegistry>;
  /** Find a ProtocolRegistry entity by chain id */
  protocolRegistryByChainId?: Maybe<ProtocolRegistry>;
  /** Retrieve paginated list of Transaction entities with optional filtering and sorting */
  transactions: TransactionPage;
  /** Find a user by their address and chain ID */
  userByAddress: User;
  /** Retrieve paginated list of User entities with optional filtering and sorting */
  users: UserPage;
  /** Find a Vault entity by address and chain id */
  vaultByAddress: Vault;
  /**
   * Fetch raw composition data from Octav API for a wallet address
   * @deprecated Use the `composition` field on `Vault` instead. This query returns untyped raw JSON and will be removed in a future release.
   */
  vaultComposition?: Maybe<Scalars['JSONObject']['output']>;
  /** Retrieve paginated list of Vault entities with optional filtering and sorting */
  vaults: VaultPage;
};


export type QueryMetaArgs = {
  chainIds?: InputMaybe<Array<Scalars['Int']['input']>>;
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


export type QueryExternalSanctionsListsArgs = {
  first?: Scalars['Int']['input'];
  orderBy?: ExternalSanctionsListOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<ExternalSanctionsListFilterInput>;
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


export type QueryProtocolRegistriesArgs = {
  chainIds?: InputMaybe<Array<Scalars['Int']['input']>>;
};


export type QueryProtocolRegistryByChainIdArgs = {
  chainId: Scalars['Int']['input'];
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


export type QueryVaultCompositionArgs = {
  walletAddress: Scalars['Address']['input'];
};


export type QueryVaultsArgs = {
  entityIds?: InputMaybe<Array<Scalars['String']['input']>>;
  first?: Scalars['Int']['input'];
  orderBy?: VaultOrderBy;
  orderDirection?: InputMaybe<OrderDirection>;
  search?: InputMaybe<Scalars['String']['input']>;
  skip?: Scalars['Int']['input'];
  where?: InputMaybe<VaultFilterInput>;
};

/** Fee rates for the vault, all expressed in basis points (1 BPS = 0.01%). Management and performance rates are staged via newRatesTimestamp/feeRatesCooldown; entry, exit, and haircut rates are applied immediately with no cooldown. */
export type Rates = {
  __typename?: 'Rates';
  /** Entry fee rate in basis points. Capped at 200 BPS (2%). Applied to shares on deposit — immediately on syncDeposit, at claim time for async deposits. Can only decrease after first initialization. */
  entryRate: Scalars['Float']['output'];
  /** Exit fee rate in basis points. Capped at 200 BPS (2%). Applied to shares on redeem — immediately on syncRedeem, at claim time for async redeems, at withdraw time for closed vaults. Can only decrease after first initialization. */
  exitRate: Scalars['Float']['output'];
  /** Haircut fee rate in basis points. Capped at 2000 BPS (20%). Applied only on syncRedeem, after the exit fee. Haircut shares are burned (not sent to the fee receiver), redistributing value to remaining shareholders. */
  haircutRate: Scalars['Float']['output'];
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

/** Emitted when a redemption request is canceled. */
export type RedeemRequestCanceled = {
  __typename?: 'RedeemRequestCanceled';
  /** The controller of the canceled request. */
  controller: Scalars['Address']['output'];
  /** The id of the redeem request canceled. */
  requestId: Scalars['BigInt']['output'];
  /** The share amount that had been requested for redemption and is now refunded to the controller. */
  requestedAmount: Scalars['BigInt']['output'];
  /** The vault associated with this redeem request cancellation. */
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

/** Emitted when a deposit request is tagged with a referrer address. */
export type ReferralEvent = {
  __typename?: 'ReferralEvent';
  /** The amount of assets associated with the referred deposit request. */
  assets: Scalars['BigInt']['output'];
  /** The owner of the deposit request that is being referred. */
  owner: Scalars['Address']['output'];
  /** The referrer address credited for the deposit request. */
  referral: Scalars['Address']['output'];
  /** The id of the deposit request that the referral is attached to. */
  requestId: Scalars['BigInt']['output'];
  /** The vault associated with this referral event. */
  vault: Vault;
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
  /** Address allowed to force a totalAssets update bypassing guardrails and to manage guardrails configuration/activation. Defaults to the zero address when unset. */
  securityCouncil: Scalars['String']['output'];
  /** Address allowed to act on behalf of any controller for deposit/mint/redeem/withdraw/requestRedeem/cancelRequestDeposit. Bypasses access checks. Defaults to the zero address when unset. */
  superOperator: Scalars['String']['output'];
  /** The address responsible for updating the newTotalAssets value of the vault */
  valuationManager: Scalars['String']['output'];
  /** The address responsible for managing the whitelist of permissioned vaults */
  whitelistManager: Scalars['String']['output'];
};

/** Emitted when the safe address is irreversibly locked — it can never be rotated again. */
export type SafeLocked = {
  __typename?: 'SafeLocked';
  /** The safe address that is now permanently locked. */
  safe: Scalars['Address']['output'];
  /** The vault whose safe was locked. */
  vault: Vault;
};

/** Emitted when the safe (fund custody address) is rotated. */
export type SafeUpdated = {
  __typename?: 'SafeUpdated';
  /** New safe address. */
  newSafe: Scalars['Address']['output'];
  /** Previous safe address. */
  oldSafe: Scalars['Address']['output'];
  /** The vault whose safe was updated. */
  vault: Vault;
};

/** Emitted when the owner assigns or rotates the security council. The zero address means no security council is configured. */
export type SecurityCouncilUpdated = {
  __typename?: 'SecurityCouncilUpdated';
  /** New security council address. */
  newSecurityCouncil: Scalars['Address']['output'];
  /** Previous security council address. */
  oldSecurityCouncil: Scalars['Address']['output'];
  /** The vault whose security council was updated. */
  vault: Vault;
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

/** Emitted when the super operator address is irreversibly locked. */
export type SuperOperatorLocked = {
  __typename?: 'SuperOperatorLocked';
  /** The super operator address that was irreversibly locked. */
  superOperator: Scalars['Address']['output'];
  /** The vault whose super operator was locked. */
  vault: Vault;
};

/** Emitted when the owner assigns or rotates the super operator. The zero address means no super operator is configured. */
export type SuperOperatorUpdated = {
  __typename?: 'SuperOperatorUpdated';
  /** New super operator address. */
  newSuperOperator: Scalars['Address']['output'];
  /** Previous super operator address. */
  oldSuperOperator: Scalars['Address']['output'];
  /** The vault whose super operator was updated. */
  vault: Vault;
};

/** Emitted when the owner updates the ERC-20 token symbol. Note that wallets and explorers typically cache token metadata. */
export type SymbolUpdated = {
  __typename?: 'SymbolUpdated';
  /** New ERC-20 token symbol. */
  newSymbol: Scalars['String']['output'];
  /** Previous ERC-20 token symbol. */
  previousSymbol: Scalars['String']['output'];
  /** The vault whose symbol was updated. */
  vault: Vault;
};

/** Controls which synchronous operations are currently allowed on the vault. Orthogonal to async request/claim, which is always available. */
export type SyncMode =
  /** Both synchronous deposits and redemptions are enabled. */
  | 'Both'
  /** No synchronous operations are enabled; deposits and redemptions must go through the async request/claim flow. */
  | 'None'
  /** Only synchronous deposits are enabled; redemptions must go through the async request/claim flow. */
  | 'SyncDeposit'
  /** Only synchronous redemptions are enabled; deposits must go through the async request/claim flow. */
  | 'SyncRedeem';

/** Emitted when the safe updates which synchronous operations are allowed on the vault. */
export type SyncModeUpdated = {
  __typename?: 'SyncModeUpdated';
  /** Sync mode after the update. */
  newMode: SyncMode;
  /** Sync mode before the update. */
  oldMode: SyncMode;
  /** The vault whose sync mode changed. */
  vault: Vault;
};

/** Inclusive Unix timestamp range (seconds) to bound a historical query. When omitted, the server picks a sensible default per field. */
export type TimeRangeOptions = {
  /** Upper bound (inclusive) of the query range, as Unix timestamp in seconds. */
  endTimestamp?: InputMaybe<Scalars['Int']['input']>;
  /** Lower bound (inclusive) of the query range, as Unix timestamp in seconds. */
  startTimestamp?: InputMaybe<Scalars['Int']['input']>;
};

/** Token or position allocation within a vault composition */
export type TokenComposition = {
  __typename?: 'TokenComposition';
  /** Chain identifier (e.g., "ethereum", "base") */
  chainKey: Scalars['String']['output'];
  /** Contract address of the token (empty string if not applicable) */
  contract: Scalars['String']['output'];
  /** Detail breakdown for grouped items (e.g., "Wallet" or "Other" categories) */
  details?: Maybe<Array<TokenComposition>>;
  /** Logo URL. For positions this is the protocol logo; for wallet tokens this is the token logo. */
  logoUrl?: Maybe<Scalars['String']['output']>;
  /** Full name of the token or position */
  name: Scalars['String']['output'];
  /** Percentage of total vault value (0-100) */
  repartition: Scalars['Float']['output'];
  /** Token symbol (e.g., "USDC", "ETH") or position name */
  symbol: Scalars['String']['output'];
  /** Value of this token/position in USD */
  valueInUsd: Scalars['Float']['output'];
};

/** Emitted when the timestamp after which totalAssets is considered stale changes. */
export type TotalAssetsExpirationUpdated = {
  __typename?: 'TotalAssetsExpirationUpdated';
  /** New expiration unix timestamp. */
  newExpiration: Scalars['BigInt']['output'];
  /** Previous expiration unix timestamp. */
  oldExpiration: Scalars['BigInt']['output'];
  /** The vault whose totalAssets expiration changed. */
  vault: Vault;
};

/** Legacy pre-v0.6.0 event for the totalAssets lifespan parameter (superseded by TotalAssetsExpirationUpdated). */
export type TotalAssetsLifespanUpdated = {
  __typename?: 'TotalAssetsLifespanUpdated';
  /** New totalAssets lifespan (in seconds). */
  newLifespan: Scalars['BigInt']['output'];
  /** Previous totalAssets lifespan (in seconds). */
  oldLifespan: Scalars['BigInt']['output'];
  /** The vault whose totalAssets lifespan changed. */
  vault: Vault;
};

/** Emitted before fees are taken, SettleDeposit and SettleRedeem when there is a new vault valuation settled. */
export type TotalAssetsUpdated = {
  __typename?: 'TotalAssetsUpdated';
  /** The total assets value settled before fees, deposits and redeems. */
  totalAssets: Scalars['BigInt']['output'];
  /** The total value of all assets in the vault converted to USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
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
  /** Index of the log entry within the transaction (null for virtual events) */
  logIndex?: Maybe<Scalars['Int']['output']>;
  /** Unix timestamp when the transaction was mined */
  timestamp: Scalars['BigInt']['output'];
  /** Index of the transaction within the block (null for virtual events) */
  transactionIndex?: Maybe<Scalars['Int']['output']>;
  /** Type of transaction or event */
  type: TransactionType;
};

/** Union type representing different types of transaction that can occur, including real on-chain events and virtual ones like PeriodSummaries */
export type TransactionData = AccessModeUpdated | Approval | AsyncOnlyActivated | BeaconProxyDeployed | BlacklistUpdated | CustomRateUpdated | DefaultLogicUpdated | DefaultRateUpdated | Deposit | DepositRequest | DepositRequestCanceled | DepositSync | ExternalSanctionsListUpdated | FeeReceiverUpdated | FeeTaken | GuardrailsStatusUpdated | GuardrailsUpdated | HaircutTaken | HighWaterMarkUpdated | Initialized | LogicAdded | LogicRemoved | MaxCapUpdated | NameUpdated | NewTotalAssetsUpdated | OperatorSet | OwnershipTransferStarted | OwnershipTransferred | Paused | PeriodSummary | PreMint | ProtocolFeeReceiverUpdated | ProxyDeployed | RatesUpdated | RedeemRequest | RedeemRequestCanceled | ReferralEvent | SafeLocked | SafeUpdated | SecurityCouncilUpdated | SettleDeposit | SettleRedeem | StateUpdated | SuperOperatorLocked | SuperOperatorUpdated | SymbolUpdated | SyncModeUpdated | TotalAssetsExpirationUpdated | TotalAssetsLifespanUpdated | TotalAssetsUpdated | Transfer | Unpaused | Upgraded | ValuationManagerUpdated | WhitelistDisabled | WhitelistManagerUpdated | WhitelistUpdated | Withdraw | WithdrawSync;

/** Filter input for Transaction */
export type TransactionFilterInput = {
  /** Filter by chainId equal to value */
  chainId_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by chainId in array of values */
  chainId_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Filter by controller in array of values */
  controller_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by controller not in array of values */
  controller_not_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by owner in array of values */
  owner_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by owner not in array of values */
  owner_not_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by sender in array of values */
  sender_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by sender not in array of values */
  sender_not_in?: InputMaybe<Array<Scalars['Address']['input']>>;
  /** Filter by state equal to value */
  state_eq?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by timestamp greater than value */
  timestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  /** Filter by timestamp greater than or equal to value */
  timestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  /** Filter by timestamp less than value */
  timestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  /** Filter by timestamp less than or equal to value */
  timestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
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
  /** Emitted when the owner switches the vault between whitelist and blacklist access modes. */
  | 'AccessModeUpdated'
  /** ERC-20 Approval event on the vault share token. */
  | 'Approval'
  /** Marker emitted once when the owner irreversibly switches the vault to async-only mode. */
  | 'AsyncOnlyActivated'
  /** Emitted when a factory deploys a new beacon proxy vault. */
  | 'BeaconProxyDeployed'
  /** Emitted when the whitelist manager adds or removes an address from the blacklist. */
  | 'BlacklistUpdated'
  /** Emitted by the FeeRegistry when a per-vault protocol-rate override is set or activated. */
  | 'CustomRateUpdated'
  /** Emitted when the FeeRegistry default implementation contract is changed. */
  | 'DefaultLogicUpdated'
  /** Emitted when the FeeRegistry default protocol rate is changed. */
  | 'DefaultRateUpdated'
  /** Emitted when a user claims a previously requested and settled deposit in the ERC7540 async flow — the pending assets are converted at the settled rate and shares are minted to the owner. */
  | 'Deposit'
  /** Emitted when a deposit request happens. */
  | 'DepositRequest'
  /** Emitted when a deposit request is canceled. */
  | 'DepositRequestCanceled'
  /** Same as a 4626 Deposit event. */
  | 'DepositSync'
  /** Emitted when the whitelist manager updates the external sanctions list oracle. */
  | 'ExternalSanctionsListUpdated'
  /** Emitted when the owner rotates the fee-receiver address. */
  | 'FeeReceiverUpdated'
  /** Emitted every time the vault takes a fee (management, performance, entry, or exit). */
  | 'FeeTaken'
  /** Emitted when the security council enables or disables guardrails enforcement. */
  | 'GuardrailsStatusUpdated'
  /** Emitted when the security council updates the price-per-share evolution limits. */
  | 'GuardrailsUpdated'
  /** Emitted on syncRedeem when a haircut is applied and burned to protect remaining shareholders. */
  | 'HaircutTaken'
  /** Emitted when the high-water mark (used for performance fee accounting) is updated. */
  | 'HighWaterMarkUpdated'
  /** Emitted on proxy initialization. Carries the contract version number used at initialization time. */
  | 'Initialized'
  /** Emitted when a new implementation contract is whitelisted in the FeeRegistry. */
  | 'LogicAdded'
  /** Emitted when an implementation contract is removed from the FeeRegistry whitelist. */
  | 'LogicRemoved'
  /** Emitted when the safe updates the maximum total assets the vault can hold. */
  | 'MaxCapUpdated'
  /** Emitted when the owner updates the ERC-20 token name. */
  | 'NameUpdated'
  /** Emitted when the newTotalAssets variable is updated. */
  | 'NewTotalAssetsUpdated'
  /** ERC-7540 event: a controller authorizes or revokes an operator to act on its behalf. */
  | 'OperatorSet'
  /** Emitted when ownership transfer is initiated (pending acceptance — 2-step Ownable2Step pattern). */
  | 'OwnershipTransferStarted'
  /** Emitted when ownership transfer is finalized (the pending owner has accepted). */
  | 'OwnershipTransferred'
  /** Emitted when the vault is paused (no deposits/redemptions allowed). */
  | 'Paused'
  /** Period summaries are not events but are piece of data that summaries key vault metrics evolution. A period being a portion of time between two updates of TotalAssets. */
  | 'PeriodSummary'
  /** Emitted at vault initialization when pre-minted shares are sent to the safe in exchange for seed assets. */
  | 'PreMint'
  /** Emitted when the FeeRegistry protocol-fee receiver is rotated. */
  | 'ProtocolFeeReceiverUpdated'
  /** Emitted when a factory deploys a new vault proxy. */
  | 'ProxyDeployed'
  /** Emitted when vault fee rates get updated */
  | 'RatesUpdated'
  /** Emitted when a redemption request happens. */
  | 'RedeemRequest'
  /** Emitted when a redemption request is canceled. */
  | 'RedeemRequestCanceled'
  /** Emitted when a deposit request is tagged with a referrer address. */
  | 'ReferralEvent'
  /** Emitted when the safe address is irreversibly locked — it can never be rotated again. */
  | 'SafeLocked'
  /** Emitted when the safe (fund custody address) is rotated. */
  | 'SafeUpdated'
  /** Emitted when the owner assigns or rotates the security council. */
  | 'SecurityCouncilUpdated'
  /** Emitted when there is assets deposited in the safe. */
  | 'SettleDeposit'
  /** Emitted when there assets unwind from the safe */
  | 'SettleRedeem'
  /** Emitted when vault state changes from Open -> Closing -> Close */
  | 'StateUpdated'
  /** Emitted when the super operator address is irreversibly locked. */
  | 'SuperOperatorLocked'
  /** Emitted when the owner assigns or rotates the super operator. */
  | 'SuperOperatorUpdated'
  /** Emitted when the owner updates the ERC-20 token symbol. */
  | 'SymbolUpdated'
  /** Emitted when the safe updates which synchronous operations are allowed. */
  | 'SyncModeUpdated'
  /** Emitted when the timestamp after which totalAssets is considered stale changes. */
  | 'TotalAssetsExpirationUpdated'
  /** Legacy pre-v0.6.0 event for the totalAssets lifespan parameter (superseded by TotalAssetsExpirationUpdated). */
  | 'TotalAssetsLifespanUpdated'
  /** Emitted when the totalAssets variable is updated. */
  | 'TotalAssetsUpdated'
  /** ERC-20 Transfer event on the vault share token. Emitted on every share movement (mint, burn, P2P transfer). */
  | 'Transfer'
  /** Emitted when the vault is resumed from a paused state. */
  | 'Unpaused'
  /** EIP-1967 proxy upgrade event — the implementation contract has been swapped. */
  | 'Upgraded'
  /** Emitted when the owner rotates the valuation manager. */
  | 'ValuationManagerUpdated'
  /** Vault states are not events but it maintains key event states. */
  | 'VaultState'
  /** Legacy pre-v0.6.0 event marking the disabling of whitelist enforcement (superseded by AccessMode). */
  | 'WhitelistDisabled'
  /** Emitted when the owner rotates the whitelist manager. */
  | 'WhitelistManagerUpdated'
  /** Emitted when a whitelist entry is updated */
  | 'WhitelistUpdated'
  /** Emitted when a user claims a previously requested and settled redemption in the ERC7540 async flow — pending shares are burned at the settled rate and the corresponding assets are transferred to the receiver. */
  | 'Withdraw'
  /** ERC-4626 Withdraw mirror emitted on syncRedeem (after exit fee and haircut deduction). */
  | 'WithdrawSync';

/** ERC-20 Transfer event on the vault share token. Emitted on every share movement (mint, burn, P2P transfer). */
export type Transfer = {
  __typename?: 'Transfer';
  /** Address shares are transferred from. The zero address indicates a mint. */
  from: Scalars['Address']['output'];
  /** Address shares are transferred to. The zero address indicates a burn. */
  to: Scalars['Address']['output'];
  /** Amount of shares transferred, in share units. */
  value: Scalars['BigInt']['output'];
  /** The vault whose share token was transferred. */
  vault: Vault;
};

/** Emitted when the vault is resumed from a paused state. */
export type Unpaused = {
  __typename?: 'Unpaused';
  /** Account that triggered the unpause. */
  account: Scalars['Address']['output'];
  /** The vault that was unpaused. */
  vault: Vault;
};

/** Input for updating off-chain vault metadata */
export type UpdateVaultMetadataInput = {
  /** Average settlement time in hours */
  averageSettlement?: InputMaybe<Scalars['Float']['input']>;
  /** Detailed description of the vault and its strategy */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Off-chain soft cap on total deposits, surfaced to the frontend so vault operators can limit incoming deposits via the UI. Purely informative, no on-chain enforcement. */
  maxCapacity?: InputMaybe<Scalars['String']['input']>;
  /** Short one-line description of the vault */
  shortDescription?: InputMaybe<Scalars['String']['input']>;
  /** URL to transparency report or dashboard */
  transparencyUrl?: InputMaybe<Scalars['String']['input']>;
};

/** EIP-1967 proxy upgrade event — the implementation contract has been swapped. */
export type Upgraded = {
  __typename?: 'Upgraded';
  /** Address of the new implementation contract. */
  implementation: Scalars['Address']['output'];
  /** The vault whose proxy was upgraded. */
  vault: Vault;
};

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

/** Emitted when the owner rotates the valuation manager. */
export type ValuationManagerUpdated = {
  __typename?: 'ValuationManagerUpdated';
  /** New valuation manager address. */
  newManager: Scalars['Address']['output'];
  /** Previous valuation manager address. */
  oldManager: Scalars['Address']['output'];
  /** The vault whose valuation manager was rotated. */
  vault: Vault;
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
  /** Vault composition showing protocol and token allocations (requires Octav API) */
  composition?: Maybe<CompositionData>;
  /** Unix timestamp of when the vault was initialized on the blockchain (VaultInitialized event). */
  creationDate: Scalars['Float']['output'];
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
  /** Off-chain soft cap on total deposits, surfaced to the frontend so vault operators can limit incoming deposits via the UI. Purely informative, no on-chain enforcement. */
  maxCapacity?: Maybe<Scalars['String']['output']>;
  /** Name of the vault */
  name?: Maybe<Scalars['String']['output']>;
  /** Native yields associated with the vault */
  nativeYields: Array<NativeYield>;
  /** A transparent upgradeable proxy that allows opting into logic upgrades through a registry. Returns null for vaults that don't support this upgradeability pattern. */
  optinProxy?: Maybe<OptinProxy>;
  /** Owner of the vault */
  owner?: Maybe<Owner>;
  /** Prevent withdraw */
  preventWithdraw?: Maybe<PreventWithdraw>;
  /** Referral program associated with the vault */
  referral?: Maybe<Referral>;
  /** Brief summary of the vault */
  shortDescription?: Maybe<Scalars['String']['output']>;
  /** Current operational state and metrics of the vault. */
  state: VaultState;
  /** Vault state as of `timestamp`, reconstructed from onchain history. Returns null if no history exists at or before that time. */
  stateAt?: Maybe<HistoricalVaultState>;
  /** Historical event stream for the fields exposed by vault.state. Each field exposes an ascending time series of onchain changes within an optional TimeRangeOptions window (default: from vault creation to now). Capped at 1000 most recent events per underlying table. */
  stateHistory: VaultStateHistory;
  /** The symbol of the vault share */
  symbol?: Maybe<Scalars['String']['output']>;
  /** Transparency report URL for this vault */
  transparencyUrl?: Maybe<Scalars['String']['output']>;
};


/** A vault entity that represents a Lagoon vault contract */
export type VaultStateAtArgs = {
  timestamp: Scalars['Int']['input'];
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
  /** Filter by ownerId equal to value */
  ownerId_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by ownerId in array of values */
  ownerId_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by ownerId not equal to value */
  ownerId_not_eq?: InputMaybe<Scalars['String']['input']>;
  /** Filter by ownerId not in array of values */
  ownerId_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by state equal to value */
  state_eq?: InputMaybe<State>;
  /** Filter by state in array of values */
  state_in?: InputMaybe<Array<State>>;
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
  /** Unix timestamp (seconds) of the earliest indexed onchain event involving the user in this vault — deposit requests, redeem requests, sync deposits, share transfers (in or out), or withdrawals. Null when no indexed history exists for the pair. */
  since?: Maybe<Scalars['Float']['output']>;
  /** Current operational state and metrics of the vault position */
  state: VaultPositionState;
  /** Vault associated with this user */
  vault: Vault;
};

/** Current operational state and metrics of the vault position */
export type VaultPositionState = {
  __typename?: 'VaultPositionState';
  /** The user's position in assets. Takes into account the user's balance, pending and claimable deposit requests, and pending and claimable redeem requests. */
  assets: Scalars['BigInt']['output'];
  /** User share token balance held in the vault */
  balance: Scalars['BigInt']['output'];
  /** Settled deposit request awaiting finalization, with both settlement-time and current-PPS values */
  claimableDeposit: ClaimableDepositRequest;
  /** Settled redeem request awaiting finalization, in both asset and share units */
  claimableRedeem: VaultRequest;
  /** Pending deposit request awaiting settlement, in both asset and share units */
  pendingDeposit: VaultRequest;
  /** Pending redeem request awaiting settlement. Carries `isCancelable` so the frontend can render the Cancel button without re-deriving the rule. */
  pendingRedeem: PendingRedeemRequest;
  /** The user's position in shares. Takes into account the user's balance, pending and claimable deposit requests, and pending and claimable redeem requests. */
  shares: Scalars['BigInt']['output'];
  /**
   * User shares in this vault converted to USD
   * @deprecated use usd instead
   */
  sharesUsd?: Maybe<Scalars['Float']['output']>;
  /** The user's position in this vault converted to USD */
  usd?: Maybe<Scalars['Float']['output']>;
};

/** A deposit or redeem request in the vault lifecycle, expressed in both asset and share units */
export type VaultRequest = {
  __typename?: 'VaultRequest';
  /** Amount denominated in assets */
  assets: Scalars['BigInt']['output'];
  /** Amount denominated in shares */
  shares: Scalars['BigInt']['output'];
};

/** Current state and metrics of a vault including assets, supply, pricing, and performance data */
export type VaultState = {
  __typename?: 'VaultState';
  /** Access control mode. Determines whether the vault enforces a whitelist (deny-by-default) or a blacklist (allow-by-default). Null when not applicable. */
  accessMode?: Maybe<AccessMode>;
  /** Whether the vault allows resetting the high water mark. Immutable, set at deploy time. Defaults to false for vaults deployed before the on-chain flag existed. */
  allowHighWaterMarkReset: Scalars['Boolean']['output'];
  /** Blacklisted addresses. Null for pre-v0.6 vaults (no blacklist concept). v0.6+: always returns the indexed blacklist regardless of accessMode. */
  blacklist?: Maybe<Array<Scalars['Address']['output']>>;
  /** List of curators associated with this vault */
  curators?: Maybe<Array<Curator>>;
  /** Entry fee rate in basis points. Capped at 200 BPS (2%). Applied on deposits — immediately on syncDeposit, at claim time for async. */
  entryRate: Scalars['Float']['output'];
  /** Exit fee rate in basis points. Capped at 200 BPS (2%). Applied on redeems — immediately on syncRedeem, at claim time for async, at withdraw time for closed vaults. */
  exitRate: Scalars['Float']['output'];
  /** Address of an optional external sanctions list oracle consulted by the access control check. Defaults to the zero address when unset. */
  externalSanctionsList: Scalars['String']['output'];
  /** The minimum delay (in seconds) between rates update and their enforcement */
  feeRatesCooldown: Scalars['BigInt']['output'];
  /** Price-per-share evolution limits and their activation state. */
  guardrails: Guardrails;
  /** Haircut fee rate in basis points. Capped at 2000 BPS (20%). Applied only on syncRedeem, after the exit fee. Haircut shares are burned, redistributing value to remaining shareholders. */
  haircutRate: Scalars['Float']['output'];
  /** The highest price per share ever reached, performance fees are taken when the price per share is above this value */
  highWaterMark: Scalars['BigInt']['output'];
  /** Annualized percentage returns since inception */
  inceptionApr: ApRs;
  /** Whether the vault has been irreversibly switched to async-only mode. When true, SyncMode is forced to None and cannot be re-enabled. */
  isAsyncOnly: Scalars['Boolean']['output'];
  /** Whether the vault is currently paused. Defaults to false when no pause history exists. */
  isPaused: Scalars['Boolean']['output'];
  /** Whether the whitelist is activated or not */
  isWhitelistActivated: Scalars['Boolean']['output'];
  /** The timestamp of the last fee calculation, used to compute management fees */
  lastFeeTime: Scalars['BigInt']['output'];
  /** Live APRs associated with the vault */
  liveAPR?: Maybe<LiveApr>;
  /** Management fee percentage charged by the vault */
  managementFee: Scalars['Float']['output'];
  /** Maximum total assets the vault can hold, in asset units. Enforced on syncDeposit and requestDeposit. Null when no cap is configured. */
  maxCap?: Maybe<Scalars['BigInt']['output']>;
  /** Monthly annualized percentage returns */
  monthlyApr: ApRs;
  /** The timestamp at which the new rates will be applied */
  newRatesTimestamp: Scalars['BigInt']['output'];
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
  /** The asset amounts currently in the vault custody */
  safeAssetBalance: Scalars['BigInt']['output'];
  /** The USD asset amounts currently in the vault custody */
  safeAssetBalanceUsd?: Maybe<Scalars['Float']['output']>;
  /** Whether updates to the safe address have been irreversibly locked. Once true, the safe address can no longer be changed. Pre-v0.6.0 vaults had no mechanism to change the safe address either, so they are reported as locked (true). */
  safeLocked: Scalars['Boolean']['output'];
  /** The status of the vault, open, closed, or closing */
  state: State;
  /** Whether updates to the super operator role have been irreversibly locked. Null when not applicable — the super operator role did not exist on pre-v0.6.0 vaults. Once true, the super operator can no longer be changed. */
  superOperatorLocked?: Maybe<Scalars['Boolean']['output']>;
  /** Which synchronous operations are currently allowed (Both, SyncDeposit, SyncRedeem, None). Orthogonal to async. */
  syncMode: SyncMode;
  /** Total assets under management in the vault */
  totalAssets: Scalars['BigInt']['output'];
  /** Unix timestamp after which totalAssets is considered stale and synchronous operations are disabled until the next valuation update. */
  totalAssetsExpiration: Scalars['BigInt']['output'];
  /** Duration in seconds that a totalAssets valuation stays valid before expiring (how long the vault stays in synchronous mode). Derived from the latest TotalAssetsLifespanUpdated event; null when never configured. */
  totalAssetsLifespan?: Maybe<Scalars['BigInt']['output']>;
  /** Total assets value in USD */
  totalAssetsUsd?: Maybe<Scalars['Float']['output']>;
  /** Total supply of vault shares */
  totalSupply: Scalars['BigInt']['output'];
  /** Upcoming management fee rates applied at newRatesTimestamp else null */
  upcomingManagementFee?: Maybe<Scalars['Float']['output']>;
  /** Upcoming performance fee rates applied at newRatesTimestamp else null */
  upcomingPerformanceFee?: Maybe<Scalars['Float']['output']>;
  /** Vault version */
  version: Scalars['String']['output'];
  /** Weekly annualized percentage returns */
  weeklyApr: ApRs;
  /** Whitelisted addresses. Pre-v0.6: null when isWhitelistActivated is false. v0.6+: always returns the indexed whitelist regardless of accessMode (mode only gates deposits). */
  whitelist?: Maybe<Array<Scalars['Address']['output']>>;
  /** Yearly annualized percentage returns */
  yearlyApr: ApRs;
};

/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistory = {
  __typename?: 'VaultStateHistory';
  /** History of the minimum delay (seconds) between fee rates update and enforcement. */
  feeRatesCooldown: Array<BigIntDataPoint>;
  /** Highest price per share ever reached, history. */
  highWaterMark: Array<BigIntDataPoint>;
  /** History of the last fee-calculation timestamp. */
  lastFeeTime: Array<BigIntDataPoint>;
  /** Management fee percentage history. */
  managementFee: Array<FloatDataPoint>;
  /** History of the timestamp at which new fee rates become applicable. */
  newRatesTimestamp: Array<BigIntDataPoint>;
  /** History of the proposed next-settlement total assets valuation. */
  newTotalAssets: Array<BigIntDataPoint>;
  /** Performance fee percentage history. */
  performanceFee: Array<FloatDataPoint>;
  /** Price per vault share in base units, history. */
  pricePerShare: Array<BigIntDataPoint>;
  /** Price per vault share in USD, history. */
  pricePerShareUsd: Array<FloatDataPoint>;
  /** Protocol fee percentage history. */
  protocolFee: Array<FloatDataPoint>;
  /** Total assets under management history. */
  totalAssets: Array<BigIntDataPoint>;
  /** Total assets value in USD history. */
  totalAssetsUsd: Array<FloatDataPoint>;
  /** Total supply of vault shares history. */
  totalSupply: Array<BigIntDataPoint>;
  /** Upcoming management fee history. */
  upcomingManagementFee: Array<FloatDataPoint>;
  /** Upcoming performance fee history. */
  upcomingPerformanceFee: Array<FloatDataPoint>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryFeeRatesCooldownArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryHighWaterMarkArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryLastFeeTimeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryManagementFeeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryNewRatesTimestampArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryNewTotalAssetsArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryPerformanceFeeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryPricePerShareArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryPricePerShareUsdArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryProtocolFeeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryTotalAssetsArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryTotalAssetsUsdArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryTotalSupplyArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryUpcomingManagementFeeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};


/** Historical event stream for vault state and fee configuration. Each field exposes an ascending time series of the underlying value, one point per onchain change within the requested range. Capped at 1000 most recent events per underlying table. */
export type VaultStateHistoryUpcomingPerformanceFeeArgs = {
  options?: InputMaybe<TimeRangeOptions>;
};

/** Legacy pre-v0.6.0 event marking the disabling of whitelist enforcement (superseded by AccessMode). */
export type WhitelistDisabled = {
  __typename?: 'WhitelistDisabled';
  /** The vault whose whitelist enforcement was disabled. */
  vault: Vault;
};

/** Emitted when the owner rotates the whitelist manager. */
export type WhitelistManagerUpdated = {
  __typename?: 'WhitelistManagerUpdated';
  /** New whitelist manager address. */
  newManager: Scalars['Address']['output'];
  /** Previous whitelist manager address. */
  oldManager: Scalars['Address']['output'];
  /** The vault whose whitelist manager was rotated. */
  vault: Vault;
};

/** Emitted when a whitelist entry is updated. */
export type WhitelistUpdated = {
  __typename?: 'WhitelistUpdated';
  /** The address of the account being updated. */
  account: Scalars['Address']['output'];
  /** Indicates whether the account is authorized (true) or not (false). */
  authorized: Scalars['Boolean']['output'];
  /** The vault associated with this whitelist update. */
  vault: Vault;
};

/** Emitted when a user claims a previously requested and settled redemption in the ERC7540 async flow — pending shares are burned at the settled rate and the corresponding assets are transferred to the receiver. */
export type Withdraw = {
  __typename?: 'Withdraw';
  /** Amount of assets withdrawn. */
  assets: Scalars['BigInt']['output'];
  /** The address whose shares are burned. */
  owner: Scalars['Address']['output'];
  /** The address that receives the withdrawn assets. May differ from `sender` and `owner`. */
  receiver: Scalars['Address']['output'];
  /** The address that called `withdraw`. */
  sender: Scalars['Address']['output'];
  /** Amount of shares burned. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with the withdraw */
  vault: Vault;
};

/** ERC-4626 Withdraw mirror emitted on syncRedeem. */
export type WithdrawSync = {
  __typename?: 'WithdrawSync';
  /** Net assets transferred to the receiver (after exit fee and haircut). */
  assets: Scalars['BigInt']['output'];
  /** Address whose shares are burned. */
  owner: Scalars['Address']['output'];
  /** Address that receives the assets. May differ from sender and owner. */
  receiver: Scalars['Address']['output'];
  /** Address that called syncRedeem. */
  sender: Scalars['Address']['output'];
  /** Shares burned — includes the exit-fee and haircut portions. */
  shares: Scalars['BigInt']['output'];
  /** The vault associated with this sync redemption. */
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
