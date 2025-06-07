import { isIpfsLink } from '@/network/ipfs';

// // Mock the ipfsUri regex import
// jest.mock('@public/constants/regex.json', () => ({
//   ipfsUri: '^ipfs://([a-zA-Z0-9]+)$',
// }));

describe('isIpfsLink', () => {
  it('returns true for valid ipfs links', () => {
    expect(isIpfsLink('ipfs://QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D')).toBe(true);
    expect(isIpfsLink('ipfs://abcdef123456')).toBe(false);
  });

  it('returns false for invalid ipfs links', () => {
    expect(isIpfsLink('http://example.com')).toBe(false);
    expect(isIpfsLink('ipfs:/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')).toBe(false);
    expect(isIpfsLink('ipfs://')).toBe(false);
    expect(isIpfsLink('')).toBe(false);
    expect(isIpfsLink('ipfs://bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze')).toBe(true);
  });
});
