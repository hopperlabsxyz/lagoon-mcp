import { describe, it, expect } from 'vitest';
import {
  encodeErrorResult,
  encodeFunctionData,
  parseAbi,
  toHex,
  type Address,
  type PublicClient,
} from 'viem';
import {
  NAV_EXPIRATION_SLOT,
  SLOT_PROBE,
  VAULT_STATE_SLOT,
  allowanceKey,
  decodeRevert,
  isSimulateUnsupported,
  issueCodeForRevert,
  readChainState,
  simulatePlan,
} from '../../src/deposit/chain';
import { erc20Abi, vaultAbi } from '../../src/deposit/abi';
import { DEPOSIT_CHAINS } from '../../src/deposit/config';

const eth = DEPOSIT_CHAINS[1];
const ACCOUNT = '0xa11ce00000000000000000000000000000000001' as Address;
const V6 = '0x1000000000000000000000000000000000000001' as Address;
const V5 = '0x2000000000000000000000000000000000000002' as Address;

type Call = { functionName: string; address: Address };
const ok = (result: unknown) => ({ status: 'success' as const, result });
const fail = { status: 'failure' as const, error: new Error('reverted') };

/** A node: v0.6 vault V6 (open, NAV valid until 2000s) and v0.5 vault V5 (closing) */
function fakeClient(): PublicClient {
  const perVault: Record<Address, Record<string, unknown>> = {
    [V6]: {
      name: 'Six',
      version: 'v0.6.0',
      asset: eth.usdc,
      decimals: 18,
      paused: false,
      isAllowed: true,
      maxCap: 5n,
      totalAssets: 2n,
      syncMode: 0,
      isTotalAssetsValid: true,
      feeRates: { entryRate: 25 },
      pendingDepositRequest: 0n,
      allowance: 7n,
    },
    [V5]: {
      name: 'Five',
      version: 'v0.5.0',
      asset: eth.usdc,
      decimals: 18,
      paused: false,
      isWhitelisted: true,
      totalAssets: 3n,
      isTotalAssetsValid: false,
      pendingDepositRequest: 4n,
      allowance: 0n,
    },
  };
  const storage: Record<string, string> = {
    [`${V6}:${VAULT_STATE_SLOT}`]: toHex(0n, { size: 32 }),
    [`${V6}:${NAV_EXPIRATION_SLOT}`]: toHex((99n << 128n) + 2000n, { size: 32 }),
    [`${V5}:${VAULT_STATE_SLOT}`]: toHex(1n, { size: 32 }),
  };
  return {
    getBlock: () => Promise.resolve({ number: 10n, timestamp: 1000n }),
    readContract: () => Promise.resolve(50n),
    getStorageAt: ({ address, slot }: { address: Address; slot: string }) =>
      Promise.resolve(storage[`${address}:${slot}`]),
    multicall: ({ contracts }: { contracts: Array<Call & { args?: unknown[] }> }) =>
      Promise.resolve(
        contracts.map((c) => {
          if (c.functionName === 'isInstance') return ok(c.address === eth.factories[0]);
          // allowance is read on the USDC contract, for the vault given as spender
          const vault = c.functionName === 'allowance' ? (c.args?.[1] as Address) : c.address;
          const value = perVault[vault]?.[c.functionName];
          return value === undefined ? fail : ok(value);
        })
      ),
  } as unknown as PublicClient;
}

describe('readChainState', () => {
  it('maps every read to its vault, per version', async () => {
    const reading = await readChainState(fakeClient(), eth, ACCOUNT, [V6, V5]);
    expect(reading).toMatchObject({ blockNumber: 10n, timestamp: 1000n, balance: 50n });
    expect(reading.vaults[0]).toMatchObject({
      name: 'Six',
      version: 'v0.6.0',
      isLagoon: true,
      isAllowed: true,
      maxCap: 5n,
      syncMode: 0,
      navValid: true,
      entryRateBps: 25,
      allowance: 7n,
      state: 0,
      // Only the low 128 bits: the high ones are the NAV lifespan
      navExpiration: 2000n,
    });
  });

  it('reads the allowlist of v0.1 to v0.5 through isWhitelisted, and no cap or sync mode', async () => {
    const [, v5] = (await readChainState(fakeClient(), eth, ACCOUNT, [V6, V5])).vaults;
    expect(v5).toMatchObject({
      isAllowed: true,
      maxCap: undefined,
      syncMode: undefined,
      entryRateBps: undefined,
      pendingDeposit: 4n,
      state: 1,
    });
  });
});

describe('decodeRevert', () => {
  it('names Lagoon errors of every version, and gives a plain revert its reason', () => {
    const name = (data: `0x${string}`) => decodeRevert(data);
    expect(name(encodeErrorResult({ abi: vaultAbi, errorName: 'NotWhitelisted' }))).toBe(
      'NotWhitelisted'
    );
    expect(name(encodeErrorResult({ abi: vaultAbi, errorName: 'OnlySyncDepositAllowed' }))).toBe(
      'OnlySyncDepositAllowed'
    );
    const reason = encodeErrorResult({
      abi: parseAbi(['error Error(string)']),
      errorName: 'Error',
      args: ['ERC20: transfer amount exceeds allowance'],
    });
    expect(name(reason)).toBe('ERC20: transfer amount exceeds allowance');
    expect(name('0x12345678')).toBeUndefined();
    expect(name('0x')).toBeUndefined();
  });

  it('maps the allowlist errors of both versions to ACCESS_DENIED', () => {
    expect(issueCodeForRevert('NotWhitelisted')).toBe('ACCESS_DENIED');
    expect(issueCodeForRevert('AddressNotAllowed')).toBe('ACCESS_DENIED');
    expect(issueCodeForRevert('Something')).toBe('SIMULATION_FAILED');
  });
});

describe('simulatePlan without eth_simulateV1 (Avalanche nodes)', () => {
  const SLOT = 9n;
  const approve = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [V5, 10n] });
  const deposit = encodeFunctionData({
    abi: vaultAbi,
    functionName: 'requestDeposit',
    args: [10n, ACCOUNT, ACCOUNT],
  });

  // A node that refuses eth_simulateV1; eth_call reverts a deposit unless the
  // allowance slot holds the approval
  function avalancheNode(seen: Array<{ to: Address; overridden: boolean }>): PublicClient {
    return {
      chain: { id: 43114 },
      simulateCalls: () =>
        Promise.reject(
          Object.assign(new Error('eth_simulateV1 is not available on the AVAX_MAINNET'), {
            code: -32600,
          })
        ),
      call: ({
        to,
        data,
        stateOverride,
      }: {
        to: Address;
        data: `0x${string}`;
        stateOverride?: Array<{ stateDiff: Array<{ slot: string; value: string }> }>;
      }) => {
        const diffs = stateOverride?.flatMap((o) => o.stateDiff) ?? [];
        // Finding the allowance slot: the override must be read back at SLOT only
        if (data.startsWith('0xdd62ed3e')) {
          const key = allowanceKey(SLOT_PROBE.owner, SLOT_PROBE.spender, SLOT);
          const hit = diffs.find((d) => d.slot === key);
          return Promise.resolve({ data: hit ? hit.value : toHex(0n, { size: 32 }) });
        }
        seen.push({ to, overridden: diffs.length > 0 });
        if (data === deposit && diffs.length === 0)
          return Promise.reject(
            Object.assign(new Error('reverted'), {
              data: encodeErrorResult({
                abi: parseAbi(['error Error(string)']),
                errorName: 'Error',
                args: ['ERC20: transfer amount exceeds allowance'],
              }),
            })
          );
        return Promise.resolve({ data: '0x' });
      },
    } as unknown as PublicClient;
  }

  it('replays each step with eth_call, the earlier approvals written into storage', async () => {
    const seen: Array<{ to: Address; overridden: boolean }> = [];
    const result = await simulatePlan(avalancheNode(seen), 43114, 10n, ACCOUNT, [
      { id: 's1', execution: { to: eth.usdc, data: approve } },
      { id: 's2', execution: { to: V5, data: deposit } },
    ]);
    expect(result).toMatchObject({ method: 'eth_call', success: true });
    expect(seen).toEqual([
      { to: eth.usdc, overridden: false },
      { to: V5, overridden: true },
    ]);
  });

  it('reports a step that reverts, with its reason', async () => {
    const result = await simulatePlan(avalancheNode([]), 43114, 10n, ACCOUNT, [
      { id: 's1', execution: { to: V5, data: deposit } },
    ]);
    expect(result.success).toBe(false);
    expect(result.calls[0].error).toBe('ERC20: transfer amount exceeds allowance');
  });

  it('only falls back when the node lacks the method', () => {
    expect(
      isSimulateUnsupported(new Error('eth_simulateV1 is not available on the AVAX_MAINNET'))
    ).toBe(true);
    expect(isSimulateUnsupported(Object.assign(new Error('x'), { code: -32601 }))).toBe(true);
    expect(isSimulateUnsupported(new Error('execution reverted'))).toBe(false);
  });
});
