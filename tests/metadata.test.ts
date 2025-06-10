import { getTokenMetadata, getMetadata } from '@/index';

describe('token metadata', () => {
  it('fetch FA1.2 token metadata from token_metadata[0][1]', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(kusd);

    expect(kusdTokenMetadata).toBeDefined();
    expect(kusdTokenMetadata!.name).toBe('Kolibri USD');
    expect(kusdTokenMetadata!.symbol).toBe('kUSD');
    expect(kusdTokenMetadata!.decimals).toBe('18');
  }, 5000);

  it('fetch FA1.2 token metadata from token_metadata[0]["token_info"]', async () => {
    const kdao: string = 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH';
    const kdaoTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(kdao);

    expect(kdaoTokenMetadata).toBeDefined();
    expect(kdaoTokenMetadata!.name).toBe('Kolibri DAO');
    expect(kdaoTokenMetadata!.symbol).toBe('kDAO');
    expect(kdaoTokenMetadata!.decimals).toBe('18');
  }, 5000);

  it('fetch FA2 token metadata from assets.token_metadata[0][token_id]["token_info"]', async () => {
    const crunch: string = 'KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng';
    const crunchTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(crunch, 0);

    expect(crunchTokenMetadata).toBeDefined();
    expect(crunchTokenMetadata!.name).toBeUndefined();
    expect(crunchTokenMetadata!.symbol).toBe('CRUNCH');
    expect(crunchTokenMetadata!.decimals).toBe('8');
    const icon: string = 'ipfs://bafybeienhhbxz53n3gtg7stjou2zs3lmhupahwovv2kxwh5uass3bc5xzq';
    expect(crunchTokenMetadata!.thumbnailUri).toBe(icon);
    expect(crunchTokenMetadata!.shouldPreferSymbol).toBe('true');
  }, 5000);

  it('multi-token FA2 contract', async () => {
    const abr: string = 'KT1UG6PdaKoJcc3yD6mkFVfxnS1uJeW3cGeX';
    const abrTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(abr, 1);

    expect(abrTokenMetadata).toBeDefined();
    expect(abrTokenMetadata!.name).toBe('Allbridge Wrapped BUSD');
    expect(abrTokenMetadata!.symbol).toBe('abBUSD');
    expect(abrTokenMetadata!.decimals).toBe('6');
  }, 5000);
});

describe('contract metadata', () => {
  it('directly from from BigMap members', async () => {
    const swc: string = 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g';
    const swcTokenMetadata: TZip17Metadata | undefined = await getMetadata(swc);

    expect(swcTokenMetadata).toBeDefined();
    expect(swcTokenMetadata!.name).toBe('SwindleCoin');
    expect(swcTokenMetadata!.version).toBe('v1.0');
    const description: string = 'This token is worth nothing. Anyone who says otherwise is trying to swindle you.';
    expect(swcTokenMetadata!.description).toBe(description);
  }, 5000);

  it('from internal contract storage, tezos-storage:data', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdTokenMetadata: TZip17Metadata | undefined = await getMetadata(kusd);

    expect(kusdTokenMetadata).toBeDefined();
    expect(kusdTokenMetadata!.name).toBe('Kolibri Token Contract');
    expect(kusdTokenMetadata!.description).toBe('FA1.2 Implementation of kUSD');
    expect(kusdTokenMetadata!.homepage).toBe('https://kolibri.finance');
  }, 5000);

  // This asset appears to be a scam, but it's the only one I could find with this metadata format.
  it('from external contract storage, tezos-storage://KT1GetVcigbLbWExeb6BqxHtZCbPGndJX2Xg/metadataJSON', async () => {
    const usds: string = 'KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf';
    const usdsTokenMetadata: TZip17Metadata | undefined = await getMetadata(usds);

    expect(usdsTokenMetadata).toBeDefined();
    expect(usdsTokenMetadata!.homepage).toBe('https://stably.io/');
    expect(usdsTokenMetadata!.name).toBe('Stably USD');
    expect(usdsTokenMetadata!.version).toBe('1.7.0');
    expect(usdsTokenMetadata!.license!['name']).toBe('MIT');
  }, 5000);

  it('fetch metadata from assets.metadata and IPFS', async () => {
    const plenty: string = 'KT1GRSvLoikDsXujKgZPsGLX8k8VvR2Tq95b';
    const plentyTokenMetadata: TZip17Metadata | undefined = await getMetadata(plenty);

    expect(plentyTokenMetadata).toBeDefined();
    expect(plentyTokenMetadata!.name).toBe('PLENTY');
    expect(plentyTokenMetadata!.description).toBe('Plenty DeFi DAO');
    expect(plentyTokenMetadata!.homepage).toBe('https://plentydefi.com');
    expect(plentyTokenMetadata!.interfaces[0]).toBe('TZIP-007-2021-04-17');
    expect(plentyTokenMetadata!.interfaces[1]).toBe('TZIP-016-2021-04-17');
  }, 5000);
});
