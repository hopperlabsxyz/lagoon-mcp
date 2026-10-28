/**
 * Minimal ABIs for deposit plans (Lagoon vault v0.6.0, ERC-20, factory).
 * Taken from the v0.6.0 vault ABI in @lagoon-protocol/v0-core (sdk-v0); the
 * pinned v0-core 0.9.0 predates v0.6.0.
 */

import { parseAbi } from 'viem';

export const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const factoryAbi = parseAbi(['function isInstance(address vault) view returns (bool)']);

export const vaultAbi = parseAbi([
  'struct Rates { uint16 managementRate; uint16 performanceRate; uint16 entryRate; uint16 exitRate; uint16 haircutRate; }',
  'function name() view returns (string)',
  'function version() pure returns (string)',
  'function asset() view returns (address)',
  'function decimals() view returns (uint8)',
  'function paused() view returns (bool)',
  'function isAllowed(address account) view returns (bool)',
  'function maxCap() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function syncMode() view returns (uint8)',
  'function isTotalAssetsValid() view returns (bool)',
  'function feeRates() view returns (Rates)',
  'function previewSyncDeposit(uint256 assets) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function pendingDepositRequest(uint256 requestId, address controller) view returns (uint256)',
  'function claimableDepositRequest(uint256 requestId, address controller) view returns (uint256)',
  'function requestDeposit(uint256 assets, address controller, address owner) payable returns (uint256)',
  'function syncDeposit(uint256 assets, address receiver, address referral) payable returns (uint256)',
  'event DepositRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 assets)',
  'event DepositSync(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event DepositRequestCanceled(uint256 indexed requestId, address indexed controller)',
  'error AddressNotAllowed(address _address)',
  'error BelowMinimumAssets(uint256 assets, uint256 minimumAssets)',
  'error Closed()',
  'error EnforcedPause()',
  'error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)',
  'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
  'error MaxCapReached()',
  'error NotOpen(uint8 currentState)',
  'error OnlyOneRequestAllowed()',
  'error SyncOperationNotAllowed()',
  'error TotalAssetsExpired()',
]);

/** syncMode() values (v0.6.0 `SyncMode` enum) */
export const SYNC_MODE = { Both: 0, SyncDeposit: 1, SyncRedeem: 2, None: 3 } as const;
