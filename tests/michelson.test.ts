import { unwrapMichelsonMap } from '@/index';
import { MichelsonMap } from '@taquito/michelson-encoder';

describe('unwrapMichelsonMap', () => {
  it('should unwrap a simple MichelsonMap to a plain object', async () => {
    const map = new MichelsonMap();
    map.set('foo', 'bar');
    map.set('baz', 42);

    const result: Record<string, unknown> = unwrapMichelsonMap(map);
    expect(result).toEqual({ foo: 'bar', baz: 42 });
  });

  it('should filter out undefined values', async () => {
    const map = new MichelsonMap();
    map.set('foo', null);
    map.set('baz', 0);
    map.set('bar', undefined);

    const result = unwrapMichelsonMap(map);
    expect(result).toEqual({ foo: null, baz: 0 });
  });
});
