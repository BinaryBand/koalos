import { TezosToolkit } from '@taquito/taquito';
import { getMetadata, getTokenMetadata } from '@/tezos/metadata';
import Tezos from '@/tezos/provider';

describe('token metadata', () => {
  it('fetch token metadata from token_metadata[0]', async () => {
    const tezos: TezosToolkit = Tezos();
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdContract = await tezos.contract.at(kusd);
    const kusdTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(kusdContract);

    expect(kusdTokenMetadata).toBeDefined();
    expect(kusdTokenMetadata?.decimals).toBe('18');
    expect(kusdTokenMetadata?.name).toBe('Kolibri USD');
    expect(kusdTokenMetadata?.symbol).toBe('kUSD');
  });

  it('fetch token metadata from assets.token_metadata[0]["token_info"]', async () => {
    const tezos: TezosToolkit = Tezos();
    const crunch: string = 'KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng';
    const crunchContract = await tezos.contract.at(crunch);
    const crunchTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(crunchContract);

    expect(crunchTokenMetadata).toBeDefined();
    expect(crunchTokenMetadata?.decimals).toBe('8');
    expect(crunchTokenMetadata?.name).toBeUndefined();
    expect(crunchTokenMetadata?.symbol).toBe('CRUNCH');
  });

  it('QUIPU token metadata', async () => {
    const tezos: TezosToolkit = Tezos();
    const quipu: string = 'KT193D4vozYnhGJQVtw7CoxxqphqUEEwK6Vb';
    const quipuContract = await tezos.contract.at(quipu);
    const quipuTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(quipuContract);

    expect(quipuTokenMetadata).toBeDefined();
    expect(quipuTokenMetadata?.decimals).toBe('6');
    expect(quipuTokenMetadata?.name).toBe('Quipuswap Governance Token');
    expect(quipuTokenMetadata?.symbol).toBe('QUIPU');
  });
});

describe('contract metadata', () => {
  it('fetch metadata from same contract storage, tezos-storage:data', async () => {
    const tezos: TezosToolkit = Tezos();
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdContract = await tezos.contract.at(kusd);
    const kusdTokenMetadata: TZip17Metadata | undefined = await getMetadata(kusdContract);

    expect(kusdTokenMetadata).toBeDefined();
    expect(kusdTokenMetadata?.name).toBe('Kolibri Token Contract');
    expect(kusdTokenMetadata?.description).toBe('FA1.2 Implementation of kUSD');
    expect(kusdTokenMetadata?.homepage).toBe('https://kolibri.finance');
  });
});
