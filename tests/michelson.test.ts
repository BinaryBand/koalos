import { unwrapMichelsonMap } from '@/tezos/michelson';
import { MichelsonMap } from '@taquito/michelson-encoder';
const { isIpfsLink, getFromIpfs } = require('@/network/ipfs');
const { isTezosLink, getFromTezos } = require('@/network/tezos-storage');
const { isJson } = require('@/tools/utils');

// Mock dependencies
jest.mock('@/network/ipfs', () => ({
  isIpfsLink: jest.fn(),
  getFromIpfs: jest.fn(),
}));
jest.mock('@/network/tezos-storage', () => ({
  isTezosLink: jest.fn(),
  getFromTezos: jest.fn(),
}));
jest.mock('@/tools/utils', () => ({
  isJson: jest.fn(),
}));

describe('unwrapMichelsonMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should unwrap a simple MichelsonMap to a plain object', async () => {
    const map = new MichelsonMap();
    map.set('foo', 'bar');
    map.set('baz', 42);
    (map as any)['valueSchema'] = { val: {} };

    const result = await unwrapMichelsonMap(map);
    expect(result).toEqual({ foo: 'bar', baz: 42 });
  });

  it('should filter out falsy values', async () => {
    const map = new MichelsonMap();
    map.set('foo', null);
    map.set('baz', 0);
    map.set('bar', 'value');
    (map as any)['valueSchema'] = { val: {} };

    const result = await unwrapMichelsonMap(map);
    expect(result).toEqual({ bar: 'value' });
  });

  it('should fetch and merge IPFS metadata if empty string key is an IPFS link', async () => {
    const map = new MichelsonMap();
    map.set('', 'ipfs://abc123');
    map.set('other', 'value');
    (map as any)['valueSchema'] = { val: {} };

    isIpfsLink.mockReturnValue(true);
    getFromIpfs.mockResolvedValue('{"meta":"data"}');
    isJson.mockReturnValue(true);

    const result = await unwrapMichelsonMap(map);
    expect(isIpfsLink).toHaveBeenCalledWith('ipfs://abc123');
    expect(getFromIpfs).toHaveBeenCalledWith('ipfs://abc123');
    expect(result).toEqual({ other: 'value', meta: 'data' });
    expect(result).not.toHaveProperty('');
  });

  it('should fetch and merge Tezos metadata if empty string key is a Tezos link', async () => {
    const map = new MichelsonMap();
    map.set('', 'tezos-storage:here');
    map.set('foo', 1);
    (map as any)['valueSchema'] = { val: {} };

    isIpfsLink.mockReturnValue(false);
    isTezosLink.mockReturnValue(true);
    getFromTezos.mockResolvedValue('{"hello":"world"}');
    isJson.mockReturnValue(true);

    const result = await unwrapMichelsonMap(map, 'KT1...');
    expect(isTezosLink).toHaveBeenCalledWith('tezos-storage:here');
    expect(getFromTezos).toHaveBeenCalledWith('tezos-storage:here', 'KT1...');
    expect(result).toEqual({ foo: 1, hello: 'world' });
    expect(result).not.toHaveProperty('');
  });

  it('should not parse metadata if it is not JSON', async () => {
    const map = new MichelsonMap();
    map.set('', 'ipfs://notjson');
    (map as any)['valueSchema'] = { val: {} };

    isIpfsLink.mockReturnValue(true);
    getFromIpfs.mockResolvedValue('not a json');
    isJson.mockReturnValue(false);

    const result = await unwrapMichelsonMap(map);
    expect(result).toEqual({ '': 'ipfs://notjson' });
  });

  it('should not merge metadata if it is not an object', async () => {
    const map = new MichelsonMap();
    map.set('', 'ipfs://abc');
    (map as any)['valueSchema'] = { val: {} };

    isIpfsLink.mockReturnValue(true);
    getFromIpfs.mockResolvedValue('42');
    isJson.mockReturnValue(true);

    const result = await unwrapMichelsonMap(map);
    expect(result).toEqual({ '': 'ipfs://abc' });
  });
});
