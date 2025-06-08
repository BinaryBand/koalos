import { isIpfsLink } from '@/network/ipfs';
import { isTezosLink } from '@/network/tezos-storage';

describe('uri tests', () => {
  it('check for valid ipfs links', () => {
    expect(isIpfsLink('ipfs://QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D')).toBe(true);
    expect(isIpfsLink('ipfs://abcdef123456')).toBe(false);
    expect(isIpfsLink('http://example.com')).toBe(false);
    expect(isIpfsLink('ipfs:/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')).toBe(false);
    expect(isIpfsLink('ipfs://')).toBe(false);
    expect(isIpfsLink('')).toBe(false);
    expect(isIpfsLink('ipfs://bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze')).toBe(true);
  });

  it('check for valid tezos links', () => {
    expect(isTezosLink('tezos-storage:token-data')).toBe(true);
    expect(isTezosLink('tezos-storage://KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV')).toBe(true);
    expect(isTezosLink('tezos-storage://KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH/token-data')).toBe(true);
    expect(isTezosLink('tezos-storage://KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn/token%2data')).toBe(true);
    expect(isTezosLink('tezos:KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g')).toBe(false);
  });
});
