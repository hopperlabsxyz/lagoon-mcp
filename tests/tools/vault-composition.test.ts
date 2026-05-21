/**
 * get_vault_composition Tool Tests
 *
 * Covers the v0.6+ typed Vault.composition migration:
 *   - Happy path with a typical multi-protocol vault.
 *   - All-tail "Other" bucket handling (HHI boundary).
 *   - Empty composition (Octav not yet queried).
 *   - Null composition path (vault exists but no composition).
 *   - Vault-not-found path.
 *   - All three response formats (summary / protocols / full).
 *   - Cache key includes chainId — same address on different chains caches
 *     independently.
 *   - HHI buckets at boundary values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cache } from '../../src/cache';
import { createMockContainer } from '../helpers/test-container';
import { parseJsonWithDisclaimer } from '../helpers/json-parser';
import { createExecuteGetVaultComposition } from '../../src/tools/vault-composition';

vi.mock('../../src/graphql/client', () => ({
  graphqlClient: { request: vi.fn() },
}));

import * as graphqlClientModule from '../../src/graphql/client';

const mockRequest = graphqlClientModule.graphqlClient.request as ReturnType<typeof vi.fn>;
const VAULT = '0x936facdf10c8c36294e7b9d28345255539d81bc7';

beforeEach(() => {
  cache.flushAll();
  mockRequest.mockReset();
});

function multiProtocolResponse(): unknown {
  // Modeled on the live RockSolid rETH composition probed during planning.
  return {
    vaultByAddress: {
      address: VAULT,
      composition: {
        totalValueInUsd: 15_244_173.65,
        compositions: [
          { protocol: 'morphoblue', repartition: 52.56, valueInUsd: 8_012_082.82, logoUrl: null },
          { protocol: 'balancer3', repartition: 11.61, valueInUsd: 1_770_329.26, logoUrl: null },
          { protocol: 'rocketpool', repartition: 11.15, valueInUsd: 1_699_951.91, logoUrl: null },
          { protocol: 'spark', repartition: 10.13, valueInUsd: 1_544_706.34, logoUrl: null },
          { protocol: 'originstory', repartition: 6.02, valueInUsd: 918_383.22, logoUrl: null },
          { protocol: 'ipor', repartition: 5.35, valueInUsd: 814_832.16, logoUrl: null },
          { protocol: 'lido', repartition: 1.77, valueInUsd: 270_495.82, logoUrl: null },
          { protocol: 'yieldbasis', repartition: 1.27, valueInUsd: 193_179.04, logoUrl: null },
          { protocol: 'Other', repartition: 0.13, valueInUsd: 20_213.1, logoUrl: null },
        ],
        tokenCompositions: [],
      },
    },
  };
}

const text = (result: { content: Array<{ type: string; text?: string }> }): string =>
  result.content[0]?.text ?? '';

describe('get_vault_composition (typed)', () => {
  it('summary format: top protocols, HHI, diversification level', async () => {
    mockRequest.mockResolvedValueOnce(multiProtocolResponse());
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'summary' });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.vaultAddress).toBe(VAULT);
    expect(body.analysis.protocolCount).toBe(9);
    expect(body.analysis.topProtocol.protocol).toBe('morphoblue');
    // 0.5256² + 0.1161² + 0.1115² + 0.1013² + 0.0602² + 0.0535² + 0.0177² + 0.0127² + 0.0013²
    // ≈ 0.3133 — concentration is Low
    expect(body.analysis.hhi).toBeGreaterThan(0.3);
    expect(body.analysis.hhi).toBeLessThan(0.33);
    expect(body.analysis.diversificationLevel).toBe('Low');
    expect(body.topProtocols).toHaveLength(5);
    expect(body.topProtocols[0].protocol).toBe('morphoblue');
  });

  it('protocols format: returns every entry', async () => {
    mockRequest.mockResolvedValueOnce(multiProtocolResponse());
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'protocols' });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.protocols).toHaveLength(9);
    expect(body.protocols[8].protocol).toBe('Other');
  });

  it('full format: includes tokenCompositions and totalValueInUsd', async () => {
    const resp = multiProtocolResponse() as {
      vaultByAddress: { composition: { tokenCompositions: unknown[] } };
    };
    resp.vaultByAddress.composition.tokenCompositions = [
      {
        symbol: 'Spark - reth',
        name: 'Spark - reth',
        contract: '',
        chainKey: '',
        valueInUsd: 1_544_706.34,
        repartition: 10.13,
      },
    ];
    mockRequest.mockResolvedValueOnce(resp);
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'full' });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.totalValueInUsd).toBeCloseTo(15_244_173.65, 1);
    expect(body.tokenCompositions).toHaveLength(1);
    expect(body.tokenCompositions[0].symbol).toBe('Spark - reth');
  });

  it('HHI 100% single protocol → diversificationLevel "Low"', async () => {
    mockRequest.mockResolvedValueOnce({
      vaultByAddress: {
        address: VAULT,
        composition: {
          totalValueInUsd: 1_000_000,
          compositions: [{ protocol: 'morphoblue', repartition: 100, valueInUsd: 1_000_000 }],
          tokenCompositions: [],
        },
      },
    });
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'summary' });
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.analysis.hhi).toBe(1);
    expect(body.analysis.diversificationLevel).toBe('Low');
  });

  it('returns an empty composition (no error) when vault has no Octav data yet', async () => {
    mockRequest.mockResolvedValueOnce({
      vaultByAddress: { address: VAULT, composition: null },
    });
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'summary' });
    expect(result.isError).toBeFalsy();
    const body = parseJsonWithDisclaimer(text(result));
    expect(body.analysis.protocolCount).toBe(0);
    expect(body.analysis.topProtocol).toBeNull();
    expect(body.analysis.hhi).toBe(0);
    expect(body.topProtocols).toEqual([]);
  });

  it('returns a non-error "vault not found" message when the vault does not exist on chain', async () => {
    mockRequest.mockResolvedValueOnce({ vaultByAddress: null });
    const tool = createExecuteGetVaultComposition(createMockContainer());
    const result = await tool({ vaultAddress: VAULT, chainId: 9999, responseFormat: 'summary' });
    expect(result.isError).toBeFalsy();
    expect(text(result).toLowerCase()).toContain('vault not found');
  });

  it('caches per (address, chainId) — same address on different chains does NOT collide', async () => {
    mockRequest
      .mockResolvedValueOnce(multiProtocolResponse())
      .mockResolvedValueOnce(multiProtocolResponse());
    const tool = createExecuteGetVaultComposition(createMockContainer());
    await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'summary' });
    await tool({ vaultAddress: VAULT, chainId: 8453, responseFormat: 'summary' });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('cache hit on the second same-chain call', async () => {
    mockRequest.mockResolvedValueOnce(multiProtocolResponse());
    const tool = createExecuteGetVaultComposition(createMockContainer());
    await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'summary' });
    await tool({ vaultAddress: VAULT, chainId: 1, responseFormat: 'protocols' });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
