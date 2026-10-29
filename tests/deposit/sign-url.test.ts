import { describe, it, expect } from 'vitest';
import { signUrlFor } from '../../src/deposit/config';

const intent = {
  account: { address: '0xb03eda433d5bb1ef76b63087d4042a92c02822bd' },
  source: { kind: 'wallet', asset: 'USDC' },
  totals: [{ chainId: 5042, kind: 'amount', value: '1' }],
  allocations: [
    {
      vault: { chainId: 5042, address: '0x344247959b8be57cfe5447debbc59a4f913d8058' },
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
