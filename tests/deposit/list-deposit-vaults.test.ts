import { describe, it, expect } from 'vitest';
import { selectDepositVaults } from '../../src/tools/list-deposit-vaults';

const ARC_USDC = '0x3600000000000000000000000000000000000000';
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const vault = (over: Partial<Parameters<typeof selectDepositVaults>[0][number]>) => ({
  address: '0x0000000000000000000000000000000000000001',
  name: 'Vault',
  symbol: 'vUSDC',
  isVisible: true,
  chain: { id: '8453' },
  asset: { address: BASE_USDC },
  curators: [] as Array<{ name: string }>,
  state: { version: 'v0.6.0', totalAssetsUsd: 1000 },
  ...over,
});

describe('selectDepositVaults', () => {
  const items = [
    vault({ name: 'Old Base', state: { version: 'v0.5.0', totalAssetsUsd: 9e6 } }),
    vault({
      name: 'Bridged USDC',
      asset: { address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' },
    }),
    vault({ name: 'Small Base', state: { version: 'v0.6.0', totalAssetsUsd: 10 } }),
    vault({
      name: 'Big Base',
      curators: [{ name: 'Gami' }],
      state: { version: 'v0.6.0', totalAssetsUsd: 5e6 },
    }),
    vault({
      name: 'TestUSDC',
      isVisible: false,
      chain: { id: '5042' },
      asset: { address: ARC_USDC },
    }),
    vault({ name: 'Unsupported chain', chain: { id: '56' } }),
    vault({ name: 'Ancient', state: { version: 'v0.2.0', totalAssetsUsd: 1 } }),
    vault({ name: 'Future', state: { version: 'v0.7.0', totalAssetsUsd: 9e9 } }),
  ];

  it('keeps Circle USDC vaults of every supported version, listed first then by TVL', () => {
    expect(selectDepositVaults(items, {}).map((v) => v.name)).toEqual([
      'Old Base',
      'Big Base',
      'Small Base',
      'Ancient',
      'TestUSDC',
    ]);
  });

  it('includes unlisted (test) vaults unless asked not to', () => {
    expect(selectDepositVaults(items, {}).find((v) => v.name === 'TestUSDC')?.listed).toBe(false);
    expect(selectDepositVaults(items, { includeUnlisted: false }).map((v) => v.name)).not.toContain(
      'TestUSDC'
    );
  });

  it('matches every search word against name, ticker and curator', () => {
    expect(selectDepositVaults(items, { search: 'gami base' }).map((v) => v.name)).toEqual([
      'Big Base',
    ]);
    expect(selectDepositVaults(items, { search: 'testusdc' }).map((v) => v.chain)).toEqual(['Arc']);
  });
});
