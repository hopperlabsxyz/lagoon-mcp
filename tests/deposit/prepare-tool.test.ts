import { afterEach, describe, it, expect, vi } from 'vitest';
import type { ServiceContainer } from '../../src/core/container';

const VAULT = '0x344247959b8be57cfe5447debbc59a4f913d8058';
const input = {
  source: { kind: 'wallet', asset: 'USDC' },
  total: { kind: 'amount', value: '1' },
  allocations: [{ vault: { chainId: 1, address: VAULT }, kind: 'bps', value: 10000 }],
} as never;

// prepare_deposit with a given result and a given listing in the indexer
async function run(issueCodes: string[], isVisible = true) {
  vi.resetModules();
  vi.doMock('../../src/deposit/prepare', async (original) => ({
    ...(await original<typeof import('../../src/deposit/prepare')>()),
    prepareDeposit: () =>
      Promise.resolve({
        ok: false,
        issues: issueCodes.map((code) => ({ code, severity: 'error', message: code })),
        checks: [],
      }),
  }));
  const { createExecutePrepareDeposit } = await import('../../src/tools/prepare-deposit');
  const container = {
    graphqlClient: {
      request: () =>
        Promise.resolve({
          vaults: { items: [{ address: VAULT, isVisible, chain: { id: '1' } }] },
        }),
    },
  } as unknown as ServiceContainer;
  const result = await createExecutePrepareDeposit(container)(input);
  return JSON.parse((result.content[0] as { text: string }).text) as {
    signUrl?: string;
    issues: Array<{ code: string; severity: string }>;
  };
}

describe('prepare_deposit tool', () => {
  const env = process.env.LAGOON_APP_URL;
  afterEach(() => {
    vi.doUnmock('../../src/deposit/prepare');
    process.env.LAGOON_APP_URL = env;
  });

  it('links to the app when the user can fix the request there', async () => {
    process.env.LAGOON_APP_URL = 'https://app.example';
    expect((await run(['ACCOUNT_REQUIRED'])).signUrl).toMatch(
      /^https:\/\/app\.example\/allocate\?intent=/
    );
    expect((await run(['INSUFFICIENT_BALANCE'])).signUrl).toBeDefined();
  });

  it('gives no link when a vault itself cannot take the deposit', async () => {
    process.env.LAGOON_APP_URL = 'https://app.example';
    for (const code of [
      'NOT_A_LAGOON_VAULT',
      'ASSET_MISMATCH',
      'UNSUPPORTED_VAULT_VERSION',
      'VAULT_NOT_OPEN',
    ])
      expect((await run(['ACCOUNT_REQUIRED', code])).signUrl).toBeUndefined();
  });

  it('warns when a vault is hidden from the app', async () => {
    const out = await run(['ACCOUNT_REQUIRED'], false);
    expect(out.issues.find((i) => i.code === 'UNLISTED_VAULT')?.severity).toBe('warning');
    expect((await run(['ACCOUNT_REQUIRED'], true)).issues.map((i) => i.code)).toEqual([
      'ACCOUNT_REQUIRED',
    ]);
  });
});
