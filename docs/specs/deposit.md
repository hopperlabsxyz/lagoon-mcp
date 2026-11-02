# Spec — `prepare_deposit` and `deposit_status`

> Status: **draft** · specVersion `1` · Ticket: LAG-480 · Branch: `feat/deposit-usdc`
>
> Grounded in `lagoon-v0-internal` (vault versions v0.1 to v0.6, `src/v0.5.x/`, `src/v0.6.0/` and
> the `v0.1.0`…`v0.4.0` tags) and the per-version ABIs of `@lagoon-protocol/v0-core`, verified
> against mainnet vaults on Ethereum, Base, Arbitrum, Avalanche and Arc. If this spec disagrees with
> the contracts, the contracts win — fix this file.

## 1. Purpose

First write-path capability of Lagoon MCP. It turns a deposit request ("put 20 % / 30 % / 50 % of
1M USDC into V1, V2, V3") into a **verified plan of transactions** for the user's wallet to sign.

**The agent prepares, the user signs.** The server never holds a key, never sends a transaction, and
never lets the LLM write an address or calldata.

```
agent (LLM)            prepare_deposit (deterministic)                 user
intent  ───────────▶   read chain → check → build plan  ──────────▶   review → sign
                       deposit_status: requested → claimable → claimed
```

## 2. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **All-or-nothing.** Any blocking issue → no plan. Every issue is returned at once, with hints (e.g. `remainingCapacity`). | The agent proposes a new split; the user never signs a partial plan by surprise. |
| D2 | **Receiver = `account`.** Shares, controller and owner are always the signing account. | Removes a whole class of address-substitution attacks. |
| D3 | **Vault versions v0.1 to v0.6**, by family (§3): v0.6, v0.5, and "legacy" v0.1–v0.4 (requests only; v0.1 and v0.2 have no `version()`). An unknown version (v0.7…) → `UNSUPPORTED_VAULT_VERSION`. Chains come from a supported-chains config: Ethereum, Optimism, Polygon, HyperEVM, Arc, Base, Arbitrum, Avalanche, each funded from the wallet on that chain. | Most of the TVL listed in the app is on v0.5. |
| D4 | **Exact approvals.** Approve exactly the deposit amount; skip the step when the current allowance already covers it. Never `maxUint256`. | No lingering unlimited allowance. |
| D5 | **Server-side fields.** Origin (in-app chat / external MCP), approval policy, receiver and trusted addresses are not in the input. | The agent (or a prompt injection) cannot change them. |
| D6 | **No transaction nonce in the plan.** The wallet (or Safe) assigns nonce, gas and fees at signing time. | A preset nonce breaks as soon as the user sends any other transaction. |
| D7 | **v1 does not prevent double execution on-chain.** Re-sending a plan re-deposits. Mitigations: `validUntil`, explicit preconditions, unique `planId`. Enforcement comes later (plan store, or a router contract with nonce / deadline / minShares). | Vault calls have no notion of "plan"; only a store or a contract can check a plan nonce. |
| D8 | **Every union is discriminated by `kind`.** Clients must ignore kinds they don't know. | New sources, steps, effects (bridge, unwind, claim, withdraw…) are added without breaking v1 clients. |
| D9 | **Money is never a JS number.** Input: human decimal strings (`"200000.5"`). Output: raw base units + formatted. Shares of a total in basis points (10 000 = 100 %). Math in `BigInt`. | No float rounding; LLMs are bad at base units. |
| D10 | **No referral.** Deposits pass `referral = address(0)`. Agent attribution is off-chain only (LAG-485). | Product decision. See §11 for what this implies for external MCP clients. |
| D11 | **Wallets: personal wallets (EOA) and Safe.** Safe is served by an export file for the Safe Transaction Builder, not by a live integration. | Covers retail and institutions with little extra work. |
| D12 | **A deposit counts as "completed" for grant reporting when the request transaction is mined** (`DepositRequest` or `DepositSync` event). `deposit_status` still reports settlement and claim. | Product decision. |
| D13 | **Defaults:** plan TTL 30 min · gas reserve for `max` 1 USDC (Arc only, where USDC pays gas) · no minimum per allocation beyond zero · steps ordered vault by vault. | See §6. |

## 3. Contract and chain facts (v0.6.0, Arc)

| Fact | Where | Consequence |
|------|-------|-------------|
| `OptinProxyFactory.isInstance(vault)` returns whether the factory deployed the vault. Verified on Arc: `true` for the vault `0x3442…8058`, `false` for the USDC token. | `src/protocol-v3/OptinProxyFactory.sol`; Arc factory `0xf185…752b` (`v0-core` addresses) | Primary proof that an address is a Lagoon vault (§5). |
| Arc USDC: ERC-20 at `0x3600…0000`, 6 decimals. Native gas balance (18 decimals) is the **same funds**: verified 580763684889224377 wei native = 580763 ERC-20 units for one holder. | `frontend-dapp-v2/src/lib/chains.ts`; on-chain | Read balances with ERC-20 `balanceOf` (6 decimals). Gas is paid from the same balance, hence the `max` reserve. |
| Arc has **no public RPC**; Alchemy is the only route today. | `backend/src/common/providers/viem.module.ts` | An RPC URL is required for Arc (§5). |
| Multicall3 is deployed on Arc at `0xcA11bde05977b3631167028862bE2a173976CA11`. | `frontend-dapp-v2/src/lib/customChains.ts` | Batch all reads into one call at one block. |
| `maxDeposit(controller)` returns the **claimable** amount (ERC-7540), not remaining capacity. | `vault/Vault-v0.6.0.sol` | Capacity = `maxCap − totalAssets − USDC balance of pendingSilo`. |
| `requestDeposit` / `syncDeposit` revert `MaxCapReached` above that. | `ERC7540Lib._onlyUnderMaxCap` | Check `UNDER_MAX_CAP`. |
| `syncDeposit` needs `syncMode ∈ {Both, SyncDeposit}`, `isTotalAssetsValid()`, and state `Open`. | `VaultLib._syncDepositAllowed`, `onlyOpen` | `mode: 'auto'` picks sync only when all hold. Plan expires with the NAV. |
| `requestDeposit` requires `whenNotPaused` and `isAllowed` for owner, controller and `msg.sender`. | `ERC7540Lib._requestDeposit` | Checks `VAULT_NOT_PAUSED`, `ACCOUNT_ALLOWED`. |
| A new request reverts `OnlyOneRequestAllowed` if a request from an earlier epoch is still pending. | same | Not checked before simulating in v1: warning `PENDING_DEPOSIT_EXISTS` when a request is pending, and the simulation reports the revert (`PENDING_REQUEST_EXISTS`). `NO_BLOCKING_PENDING_REQUEST` is reserved. |
| `requestDeposit` first auto-claims any claimable deposit of the controller. | same | Not reported in v1: the `autoClaim` effect and `AUTO_CLAIM_INCLUDED` are reserved. |
| The vault state (`Open`, `Closing`, `Closed`) has no getter. It is the first field of the ERC-7201 namespace `hopper.storage.vault`, slot `0x0e6b…1400`, in **every** version v0.1 to v0.6. v0.6 still takes deposit requests while closing, and they can never be settled. | `VaultStorage` in each version | Read with `eth_getStorageAt` at the plan's block; anything but `Open` → `VAULT_NOT_OPEN` (check `VAULT_OPEN`). |
| The NAV expiry (`totalAssetsExpiration`, v0.5 and v0.6) has no getter: low 128 bits of `hopper.storage.ERC7540` + 10. | `ERC7540Storage` | `validUntil` of a plan with a sync deposit is at most the NAV expiry; precondition `navValid`. |
| **v0.5**: no `syncMode`. A valid NAV allows **only** `syncDeposit` (`requestDeposit` reverts `OnlySyncDepositAllowed`); an invalid NAV only requests. `isWhitelisted` instead of `isAllowed`, no cap, no entry fee; `syncDeposit` mints `convertToShares(assets)`. | `src/v0.5.x/Vault.sol` (`onlySyncDeposit`, `onlyAsyncDeposit`) | Mode follows the NAV; `depositMode: 'async'` on a vault with a valid NAV gives a sync deposit and warning `SYNC_ONLY_VAULT`. |
| **v0.1 to v0.4**: requests only, `isWhitelisted`, no cap, no entry fee. | `v0.1.0`…`v0.4.0` tags | Always async. |
| `pendingDepositRequest(requestId, c)` / `claimableDepositRequest(requestId, c)` accept a specific request id (`0` = latest). | `ERC7540Lib` | `deposit_status` can follow one specific request (§8). |
| Access: whitelist / blacklist mode + external sanctions list, via `isAllowed(account)`. | `Accessable.sol` | One check, `ACCOUNT_ALLOWED`. |
| v0.6 entry fee `entryRate` (bps, capped 200 = 2 %). | `docs/agent-notes.md` gotcha #1 | Shown per allocation (`entryRateBps`). |
| `syncDeposit` has **no `minShares` and no deadline.** | `syncDeposit` | `estimatedShares` is an estimate only. |

## 4. `prepare_deposit` — input

```ts
type Address = `0x${string}`;
type Hex = `0x${string}`;

/** chainId is always explicit, even in v1 (single chain), so cross-chain plans keep the shape. */
interface ChainRef {
  chainId: number;
  address: Address;
}

interface PrepareDepositInput {
  specVersion?: '1';

  /** Who pays, signs, and receives the shares (D2). */
  account: {
    address: Address;
    /** v1 supports 'eoa' and 'safe' (D11). 'smartAccount' is reserved. Default 'eoa'. */
    type?: 'eoa' | 'safe' | 'smartAccount';
  };

  /** Where the funds come from. v1: the wallet, on one chain.
   *  Later: { kind: 'wallet', chainId: 'any' }, { kind: 'position', protocol, ... }. */
  source: { kind: 'wallet'; chainId: number; asset: 'USDC' };

  /** Total to deploy. Required when any allocation uses bps. */
  total?:
    | { kind: 'amount'; value: string } // "1000000"
    | { kind: 'max'; keepForGas?: string }; // balance minus a gas reserve, default "1"

  /** 1..N targets. The same vault twice → DUPLICATE_VAULT. */
  allocations: Allocation[];

  options?: {
    /** 'auto' = sync when allowed and NAV valid, else async. */
    depositMode?: 'auto' | 'async';
    /** Who receives rounding dust with bps. Default 'last'. */
    remainder?: 'last' | 'largest';
    /** Extra payloads returned with the plan. 'safeTxBuilder' is added automatically when account.type = 'safe'. */
    exports?: Array<'eip5792' | 'safeTxBuilder'>;
  };
}

type Allocation =
  | { vault: ChainRef; kind: 'amount'; value: string } // "200000"
  | { vault: ChainRef; kind: 'bps'; value: number }; // 2000 = 20 % of total
```

Validation rules (all reported together, D1):
- `allocations.length ≥ 1`, no duplicate vault.
- Sum of bps ≤ 10 000. bps without `total` → `BPS_SUM_INVALID`.
- Mixing `amount` and `bps`: each bps is a share of `total` (not of what the amounts leave). Fixed amounts plus shares must not exceed `total`, else `BPS_SUM_INVALID` — also with fixed amounts only.
- Allocations may span several chains: each chain is funded from the wallet on that chain, with its own entry in `totals` (`{ chainId, kind, value }`). `total` is for a single chain; with several chains → `INVALID_INPUT`.
- When `source.chainId` is set, every `vault.chainId` must equal it, else `CROSS_CHAIN_NOT_SUPPORTED`.
- `account` is optional: without it the vaults are still checked (vault problems are reported) but there is no plan, only `ACCOUNT_REQUIRED` and a `signUrl` (§7).
- `account.type = 'smartAccount'` → `UNSUPPORTED_ACCOUNT_TYPE`.

## 5. Runtime and trust rules

**R1 — RPC.** The MCP reads chains through viem with one RPC URL per chain, from an environment
variable (`LAGOON_RPC_URLS`, JSON map `{ "5042": "https://…" }`). There is no public fallback: **a
chain is supported only if its RPC URL is configured.** Otherwise every vault on it returns
`UNSUPPORTED_CHAIN` (`details.reason = "rpcNotConfigured"`). In the backend the variable is filled
with Lagoon's private provider. People running the MCP themselves must provide their own (e.g. an
Alchemy URL with their API key) — Arc has no public RPC.

**R2 — One block.** All state for a plan is read at a single block number (`stateAt`), batched
through Multicall3. Never mix reads from different blocks.

**R3 — No cache.** Balances, allowances, vault state, capacity, NAV validity and pending requests are
never cached. Static data (vault name, curator) may come from the cached indexer.

**R4 — Trusted addresses come from config**, never from the indexer or the input: USDC per chain,
factory per chain (`@lagoon-protocol/v0-core` addresses).

**R5 — A vault is accepted only if** `factory.isInstance(vault) == true` on one of the chain's
production factories (`@lagoon-protocol/v0-core`; dev factories are excluded) or it is a listed
legacy vault, **and** its version is v0.1 to v0.6, **and** `vault.asset() == USDC(chainId)`, **and**
its state is `Open`. The indexer is used for names, discovery and the "hidden from the app" warning
(`UNLISTED_VAULT`), never as proof. A factory is permissionless: it proves Lagoon code, not a
trustworthy curator.

**R6 — Errors from infrastructure** (RPC down, timeout) return `{ ok: false }` with
`STATE_UNAVAILABLE` when the chain cannot be read, or `SIMULATION_FAILED` ("Could not simulate…")
when only the simulation cannot run; never a partial plan. Nodes without `eth_simulateV1` (every
Avalanche node today) are simulated with `eth_call`, step by step at the plan's block, the earlier
approvals written into the token's allowance storage (its slot found on chain); each call then
sees those approvals but not the other effects of earlier steps, and has no gas figure
(`simulations[].method = "eth_call"`).

**R7 — Output transport.** The tool returns the JSON object as text content **and** as
`structuredContent`. v1 deviates on two points: no standard disclaimer (the first content item is
the bare JSON, so programmatic callers parse it directly) and no declared `outputSchema` (the tool
registry does not declare output schemas yet); typed clients use the types in `src/deposit/types.ts`.

## 6. Algorithms

**Amounts.** Convert input decimal strings to base units with the asset's decimals (6 for USDC);
more decimals than the token has → `INVALID_INPUT`.

**bps resolution.** For each bps allocation: `floor(total × bps / 10 000)`. The difference between
`total` and the sum goes to the last allocation (or the largest, with `remainder: 'largest'`).

**`total: max`.** `balanceOf(account) − keepForGas` (default 1 USDC). Negative or zero →
`INSUFFICIENT_BALANCE`. A reserve below 1 USDC → warning `LOW_GAS_RESERVE`.

**Minimum.** Each resolved allocation must be above zero (one base unit), else `AMOUNT_TOO_SMALL`.

**Step order: vault by vault**, in input order:
`[approve V1]?, deposit V1, [approve V2]?, deposit V2, …`. An approve is omitted when the current
allowance already covers the amount (`EXISTING_ALLOWANCE_USED`).

**Deposit call.**
- sync: `syncDeposit(assets, account, address(0))`
- async: `requestDeposit(assets, account, account)` (3-argument overload, no referral, D10)

**Identifiers.**
- `planId`: UUIDv7 (unique and time-ordered).
- `contentHash`: `keccak256` of the RFC 8785 (JCS) canonical JSON of `{ account, steps }`.

**`validUntil`.** `min(createdAt + 30 min, earliest NAV expiry among sync steps)`.

## 7. `prepare_deposit` — output

```ts
type PrepareDepositOutput =
  | { ok: true; plan: Plan; exports?: PlanExports }
  | { ok: false; issues: Issue[] }; // all blocking issues (D1)

interface Amount {
  raw: string; // base units, e.g. "200000000000" for 200,000 USDC (6 decimals)
  formatted: string; // "200,000.00"
  decimals: number;
  symbol: string;
}

interface Plan {
  specVersion: '1';
  planId: string; // UUIDv7, unique per plan (D7)
  contentHash: Hex; // keccak256(JCS({ account, steps }))
  createdAt: string; // ISO 8601
  validUntil: string; // §6

  account: { address: Address; type: 'eoa' | 'safe' };
  stateAt: Array<{ chainId: number; blockNumber: string; timestamp: string }>;
  allocations: ResolvedAllocation[]; // same order as input
  steps: Step[];
  /** Steps that can be sent together (same chain, no wait). v1: exactly one batch. */
  batches: Array<{ chainId: number; stepIds: string[] }>;
  checks: Check[]; // every check, passed or not, with observed values
  warnings: Issue[];
  summary: string; // generated by code, never by the LLM
}

interface ResolvedAllocation {
  vault: ChainRef & { name: string; version: string; curator?: string };
  assets: Amount;
  mode: 'sync' | 'async';
  /** v0.6 entry fee, basis points (capped 200 = 2 %). Shown before signing. */
  entryRateBps: number;
  estimatedShares: Amount | null; // sync: previewSyncDeposit at stateAt (net of entry fee); async: null
  sharesAvailability: 'immediate' | 'afterSettlement';
}
```

### Steps

```ts
interface StepBase {
  id: string; // "s1", "s2", …
  chainId: number;
  dependsOn: string[]; // v1: previous step only; a DAG later
  description: string; // generated by code
  /** Decoded call: lets any UI display and verify without trusting `data`. */
  decoded: { contract: string; function: string; args: Record<string, string> };
  /** What must hold right before sending. A client may re-check with eth_call and refuse. */
  preconditions: Precondition[];
  expectedEffects: Effect[];
}

/** NEVER carries a nonce, gas or fee fields (D6): the wallet sets them. */
interface EvmCall {
  type: 'evmCall';
  to: Address;
  data: Hex;
  value: string; // wei, always "0" for USDC deposits on Arc (native deposits disabled)
}

type Step =
  | (StepBase & { kind: 'erc20.approve'; execution: EvmCall; token: ChainRef; spender: Address; amount: Amount })
  | (StepBase & { kind: 'lagoon.syncDeposit'; execution: EvmCall; vault: ChainRef; assets: Amount })
  | (StepBase & { kind: 'lagoon.requestDeposit'; execution: EvmCall; vault: ChainRef; assets: Amount });
// Reserved for later, same shape: 'lagoon.claim', 'lagoon.cancelRequestDeposit', 'lagoon.requestRedeem',
// 'lagoon.redeem', 'bridge.cctp', 'bridge.gateway', 'wait.settlement'. Later execution types:
// 'offchainSignature' (permit — carries the token's own nonce), 'wait'.

type Precondition =
  | { kind: 'minBalance'; token: ChainRef; holder: Address; amount: Amount }
  | { kind: 'minAllowance'; token: ChainRef; owner: Address; spender: Address; amount: Amount }
  | { kind: 'vaultState'; vault: ChainRef; state: 'Open'; paused: false }
  | { kind: 'navValid'; vault: ChainRef; until: string } // sync steps only
  | { kind: 'capacity'; vault: ChainRef; atLeast: Amount }
  /** requestDeposit only: no pending request from an earlier epoch (else OnlyOneRequestAllowed). */
  | { kind: 'noBlockingPendingRequest'; vault: ChainRef; controller: Address; depositEpochId: string }; // reserved, not emitted in v1

type Effect =
  | { kind: 'balanceDelta'; token: ChainRef; holder: Address; delta: Amount; sign: '-' | '+' }
  | { kind: 'allowance'; token: ChainRef; owner: Address; spender: Address; amount: Amount }
  | { kind: 'pendingDeposit'; vault: ChainRef; controller: Address; assets: Amount }
  | { kind: 'autoClaim'; vault: ChainRef; controller: Address; assets: Amount }; // reserved, not emitted in v1
```

### Checks and issues

```ts
interface Check {
  code: CheckCode;
  target?: ChainRef;
  passed: boolean;
  observed: Record<string, string>; // e.g. { maxCap, totalAssets, pendingSilo }
  source: 'onchain' | 'indexer' | 'simulation';
}

type CheckCode =
  | 'VAULT_FROM_LAGOON_FACTORY' // R5: factory.isInstance, or a listed legacy vault
  | 'VAULT_VERSION_SUPPORTED' // R5: version v0.1 to v0.6 (none: v0.1 / v0.2)
  | 'VAULT_ASSET_IS_USDC' // R5: asset() == config USDC
  | 'VAULT_OPEN' // R5: stored state is Open (§3)
  | 'VAULT_NOT_PAUSED'
  | 'ACCOUNT_ALLOWED' // isAllowed (v0.6) or isWhitelisted (v0.1–v0.5)
  | 'UNDER_MAX_CAP' // v0.6 only; excludes the pending silo, the simulation has the final word
  | 'NO_BLOCKING_PENDING_REQUEST' // reserved, not emitted in v1 (§3)
  | 'SYNC_ALLOWED'
  | 'BALANCE_SUFFICIENT'
  | 'GAS_RESERVE'
  | 'PLAN_SIMULATED';

interface Issue {
  code: IssueCode;
  severity: 'error' | 'warning' | 'info';
  message: string; // for the agent to relay
  allocationIndex?: number;
  details?: Record<string, string>; // machine hints, e.g. { remainingCapacity: "120000" }
}

type IssueCode =
  // input
  | 'INVALID_INPUT' | 'DUPLICATE_VAULT' | 'BPS_SUM_INVALID' | 'AMOUNT_TOO_SMALL'
  | 'ACCOUNT_REQUIRED' // no account: vaults checked, no plan, signUrl given
  // v1 scope limits (become features later)
  | 'UNSUPPORTED_CHAIN' | 'UNSUPPORTED_VAULT_VERSION' | 'UNSUPPORTED_ACCOUNT_TYPE'
  | 'CROSS_CHAIN_NOT_SUPPORTED'
  // vault / account state
  | 'VAULT_NOT_FOUND' | 'NOT_A_LAGOON_VAULT' | 'ASSET_MISMATCH' | 'VAULT_NOT_OPEN' | 'VAULT_PAUSED'
  | 'ACCESS_DENIED' | 'MAX_CAP_REACHED' | 'PENDING_REQUEST_EXISTS' | 'INSUFFICIENT_BALANCE'
  // infrastructure, simulation
  | 'STATE_UNAVAILABLE' | 'SIMULATION_FAILED'
  // warnings / info
  | 'ASYNC_DEPOSIT' | 'LOW_GAS_RESERVE' | 'EXISTING_ALLOWANCE_USED'
  | 'PENDING_DEPOSIT_EXISTS' // a request of the account is still pending in the vault
  | 'SYNC_ONLY_VAULT' // async asked, but a v0.5 vault with a valid NAV only takes sync deposits
  | 'UNLISTED_VAULT' // hidden from the Lagoon app per the indexer (test or private vault)
  // reserved, not emitted in v1
  | 'SYNC_FALLBACK_TO_ASYNC' | 'AUTO_CLAIM_INCLUDED' | 'VAULT_NOT_FOUND';
```

Issue codes are a **stable public contract**: never rename or reuse one; only add.

**`signUrl`.** When `LAGOON_APP_URL` is set, the output carries `signUrl`
(`<app>/allocate?intent=<base64url request>`), which opens the request in the app to review and
sign; the app prepares the plan again. It is given when the request can be fixed there (no
account, balance, amounts), and **not** when a vault itself cannot take the deposit:
`NOT_A_LAGOON_VAULT`, `ASSET_MISMATCH`, `UNSUPPORTED_VAULT_VERSION`, `VAULT_NOT_OPEN`, or a chain
deposits do not support (`UNSUPPORTED_CHAIN` with `reason: "notConfigured"`; a chain this server
has no RPC for keeps the link).

**Hints.** `details.remainingCapacity` is a plain decimal (`"120000"`), usable as an amount.

### Exports

```ts
interface PlanExports {
  eip5792?: Array<{ chainId: Hex; calls: Array<{ to: Address; data: Hex; value: Hex }> }>; // wallet_sendCalls
  safeTxBuilder?: SafeTxBuilderFile; // JSON importable in the Safe Transaction Builder app
}
```

## 8. `deposit_status`

Follows **specific deposits**, not just the account's totals.

```ts
interface DepositStatusInput {
  account: Address;
  /** Preferred: the transaction hashes returned by the wallet. The server reads each receipt,
   *  finds the DepositRequest / DepositSync event, and follows that request id. */
  txHashes?: Array<{ chainId: number; hash: Hex }>;
  /** Fallback: latest request per vault. Later: { planId }. */
  vaults?: ChainRef[];
}

interface DepositStatusOutput {
  stateAt: Array<{ chainId: number; blockNumber: string; timestamp: string }>;
  deposits: Array<{
    vault: ChainRef & { name: string };
    txHash?: Hex;
    requestId?: string; // epoch id from the DepositRequest event; absent for sync deposits
    /** 'requested' counts as completed for grant reporting (D12). */
    status: 'notFound' | 'failed' | 'requested' | 'claimable' | 'claimed' | 'canceled' | 'synced';
    assets: Amount;
    pending: Amount; // pendingDepositRequest(requestId, account)
    claimable: Amount; // claimableDepositRequest(requestId, account)
    next?: { description: string; action?: 'lagoon.claim' | 'lagoon.cancelRequestDeposit' };
  }>;
}
```

- `synced`: a `DepositSync` event — shares received immediately.
- `requested`: request mined, waiting for settlement.
- `claimable`: settled; shares can be claimed (or are auto-claimed by the next request).
- `claimed`: request id settled and nothing left claimable for it.
- `failed`: transaction reverted. `notFound`: unknown hash or no deposit event.
- `canceled`: a `DepositRequestCanceled` event for that request (the USDC went back to the wallet).
  A canceled and a claimed request both read 0 pending / 0 claimable: the cancel events tell them
  apart, read in chunks when the provider caps log ranges; when they cannot be read, the status
  stays `claimed` and `next.description` says it may be canceled.
- Only deposit events emitted by a Lagoon vault (R5 factory check) count: any contract can emit an
  event with the same shape.

## 9. Worked example

Account `0xA11CE…`, Arc. Balance 1,000,050 USDC, no allowance. Three open v0.6.0 vaults,
V1 sync-enabled with a valid NAV, V2 and V3 async.

> Arc mainnet has a single Lagoon vault today (`TestUSDC`, `0x3442…8058`). V2 and V3 are
> hypothetical; the example becomes a fork test with deployed fixtures.

Input:

```json
{
  "account": { "address": "0xA11CE…", "type": "eoa" },
  "source": { "kind": "wallet", "chainId": 5042, "asset": "USDC" },
  "total": { "kind": "amount", "value": "1000000" },
  "allocations": [
    { "vault": { "chainId": 5042, "address": "0xV1…" }, "kind": "bps", "value": 2000 },
    { "vault": { "chainId": 5042, "address": "0xV2…" }, "kind": "bps", "value": 3000 },
    { "vault": { "chainId": 5042, "address": "0xV3…" }, "kind": "bps", "value": 5000 }
  ]
}
```

Expected plan (abridged):

| Step | kind | Call | Amount |
|------|------|------|--------|
| s1 | `erc20.approve` | `USDC.approve(V1, 200000000000)` | 200,000 |
| s2 | `lagoon.syncDeposit` | `V1.syncDeposit(200000000000, 0xA11CE, 0x0)` | 200,000 |
| s3 | `erc20.approve` | `USDC.approve(V2, 300000000000)` | 300,000 |
| s4 | `lagoon.requestDeposit` | `V2.requestDeposit(300000000000, 0xA11CE, 0xA11CE)` | 300,000 |
| s5 | `erc20.approve` | `USDC.approve(V3, 500000000000)` | 500,000 |
| s6 | `lagoon.requestDeposit` | `V3.requestDeposit(500000000000, 0xA11CE, 0xA11CE)` | 500,000 |

`batches: [{ chainId: 5042, stepIds: [s1…s6] }]` · warnings: `ASYNC_DEPOSIT` (V2, V3) ·
`validUntil` = min(now + 30 min, V1 NAV expiry).

Failure cases (each returns `ok: false` with all issues):

| Case | Issue(s) |
|------|----------|
| V2 has 120,000 USDC of capacity left | `MAX_CAP_REACHED` (allocationIndex 1, `details.remainingCapacity = "120000"`) |
| Account not whitelisted on V3 | `ACCESS_DENIED` (allocationIndex 2) |
| Older unsettled request on V2 | `PENDING_REQUEST_EXISTS` (allocationIndex 1) |
| Balance 900,000 | `INSUFFICIENT_BALANCE` (`details.missing = "100000"`) |
| V3 address is not from the factory | `NOT_A_LAGOON_VAULT` |
| bps sum 11000 | `BPS_SUM_INVALID` |
| RPC down | `STATE_UNAVAILABLE` |

## 10. Non-goals (v1) and notes for later

Non-goals: automatic vault selection (the agent uses `search_vaults` / `analyze_risk`, the user
confirms) · bridge and unwind · fork simulation · plan storage and `/plan/<id>` · withdraw, claim and
cancel tools · deposits on behalf of another address · smart accounts.

Later:
- **Blocking pending requests** (`NO_BLOCKING_PENDING_REQUEST`, `noBlockingPendingRequest`) and
  **auto-claim** reporting (`autoClaim`, `AUTO_CLAIM_INCLUDED`): reserved; v1 relies on the
  `PENDING_DEPOSIT_EXISTS` warning and the simulation.
- **Router contract** (optional, needs audit): executes a plan atomically with `nonce`, `deadline`,
  `minShares` — closes D7 and the missing slippage guard on `syncDeposit`.
- **Dependency:** lagoon-mcp pins `@lagoon-protocol/v0-core` 0.9.0, which has neither Arc nor the
  v0.6.0 ABI. Bump to the current release (0.19.x in `sdk-v0`) before implementing.

## 11. Known limitations (accepted)

- **Attribution without referral (D10).** In-app chat deposits are attributable through the backend.
  Deposits prepared by an external MCP client (Claude, Cursor) leave no trace with Lagoon and are not
  counted in the grant report. Out of scope for now; revisit with telemetry or a referral address.
