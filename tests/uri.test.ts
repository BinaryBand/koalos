import { isIpfsLink } from '@/network/ipfs';

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

  it('check for valid tezos links', () => {});
});
