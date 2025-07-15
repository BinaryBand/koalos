import { isIpfsLink } from '@/tools/ipfs';
import { isTezosLink } from '@/tezos/contracts/metadata';

const CID_V0: string = 'QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D';
const CID_V1: string = 'bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze';

describe('uri tests', () => {
  it('check for valid ipfs links', () => {
    expect(isIpfsLink(`ipfs://${CID_V0}`)).toBe(true);
    expect(isIpfsLink(`ipfs://${CID_V1}`)).toBe(true);
    expect(isIpfsLink(`ipfs://${CID_V0}/path/to/resource`)).toBe(true);
    expect(isIpfsLink('ipfs://abcdef123456')).toBe(false);
    expect(isIpfsLink('http://example.com')).toBe(false);
    expect(isIpfsLink('ipfs://')).toBe(false);
    expect(isIpfsLink('')).toBe(false);
  });

  it('check for valid tezos links', () => {
    expect(isTezosLink('tezos-storage:hello')).toBe(true);
    expect(isTezosLink('tezos-storage://KT1QDFEu8JijYbsJqzoXq7mKvfaQQamHD1kX/foo')).toBe(true);
    expect(isTezosLink('tezos-storage://KT1QDFEu8JijYbsJqzoXq7mKvfaQQamHD1kX/%2Ffoo')).toBe(true);
    expect(isTezosLink('tezos-storage:hello/world')).toBe(false);
    expect(isTezosLink('')).toBe(false);
  });
});
