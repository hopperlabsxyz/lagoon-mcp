import { afterEach, describe, it, expect, vi } from 'vitest';
import { signUrlFor } from '../../src/deposit/config';
import { CHAIN_MODULE, openVault, prepareWithChain } from '../helpers/deposit-chain';

const VAULT = '0x344247959b8be57cfe5447debbc59a4f913d8058';

const intent = {
  account: { address: '0xb03eda433d5bb1ef76b63087d4042a92c02822bd' },
  source: { kind: 'wallet', asset: 'USDC' },
  totals: [{ chainId: 5042, kind: 'amount', value: '1' }],
  allocations: [
    {
      vault: { chainId: 5042, address: VAULT },
      kind: 'bps',
      value: 10000,
    },
  ],
};

describe('signUrlFor', () => {
  it('links to /allocate with the request, decodable back to the same object', () => {
    const url = signUrlFor(intent, { LAGOON_APP_URL: 'http://localhost:3000/' });
    expect(url).toMatch(/^http:\/\/localhost:3000\/allocate\?intent=[A-Za-z0-9_-]+$/);
    const encoded = new URL(url).searchParams.get('intent')!;
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString())).toEqual(intent);
  });

  it('gives no link when the app URL is not configured', () => {
    expect(signUrlFor(intent, {})).toBeUndefined();
  });
});

describe('prepareDeposit without an account', () => {
  afterEach(() => vi.doUnmock(CHAIN_MODULE));

  // The chain as read with the probe address: one vault, open or closed
  const withVaultState = (state: number) =>
    prepareWithChain(
      {
        readChainState: () =>
          Promise.resolve({
            chainId: 5042,
            blockNumber: 1n,
            timestamp: 1n,
            balance: 0n,
            vaults: [
              openVault(VAULT, '0x3600000000000000000000000000000000000000', {
                name: 'TestUSDC',
                state,
                syncMode: undefined,
                navValid: undefined,
              }),
            ],
          }),
      },
      { ...intent, account: undefined }
    );

  it('returns ACCOUNT_REQUIRED alone when the vaults can take the deposit', async () => {
    const result = await withVaultState(0);
    expect(!result.ok && result.issues.map((i) => i.code)).toEqual(['ACCOUNT_REQUIRED']);
  });

  it('still reports a closed vault when no wallet is given', async () => {
    const result = await withVaultState(2);
    expect(!result.ok && result.issues.map((i) => i.code)).toEqual([
      'ACCOUNT_REQUIRED',
      'VAULT_NOT_OPEN',
    ]);
  });
});
