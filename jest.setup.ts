import {
  ContractResponse,
  BigMapResponse,
  RpcClient,
  RPCOptions,
  RPCRunViewParam,
  RPCSimulateOperationParam,
} from '@taquito/rpc';
import { HttpBackend } from '@taquito/http-utils';
import { Schema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';
import path from 'path';
import qs from 'qs';

import CONSTANTS from '@public/tests/constants.json';
import CONST_META from '@public/tests/constants.meta.json';
import PROTOCOLS from '@public/tests/protocols.json';
import RPC_URLS from '@public/constants/rpc-providers.json';
import { burnAddress } from '@public/tests/wallet.json';

import { fetchAndCache } from '@/tools/cache';

const BLOCK_DELAY: number = BigNumber(CONSTANTS.minimal_block_delay).toNumber() * 1000; // In seconds
const BLOCKS_PER_CYCLE: number = BigNumber(CONSTANTS.blocks_per_cycle).toNumber();
const CACHE_DIRECTORY: string = path.join(__dirname, 'tests', 'cache');

const FA2_BALANCE_RESPONSE_SCHEMA: MichelsonV1Expression = {
  prim: 'pair',
  args: [
    {
      prim: 'pair',
      args: [
        { prim: 'address', annots: ['%owner'] },
        { prim: 'nat', annots: ['%token_id'] },
      ],
      annots: ['%request'],
    },
    { prim: 'nat', annots: ['%balance'] },
  ],
};

function quickHash(seed: string, ...salt: string[]): string {
  const joined: string = [seed, ...salt].join(':');
  const randNum: BigNumber = Array.from(joined).reduce((acc, c) => acc.plus(c.charCodeAt(0)), BigNumber(23));
  return randNum.pow(seed.charCodeAt(seed.length - 3), Number.MAX_SAFE_INTEGER).toString(16);
}

function mockNum(seed: string, modulo: number = Number.MAX_SAFE_INTEGER): BigNumber {
  const mockNumber: BigNumber = Array.from(seed).reduce((acc, c) => acc.plus(c.charCodeAt(0)), BigNumber(7));
  return mockNumber.pow(seed.charCodeAt(seed.length - 3), modulo).plus(modulo);
}

jest.mock('@/tools/ipfs', () => ({
  ...jest.requireActual('@/tools/ipfs'),

  getFromIpfs: jest.fn().mockImplementation(async (uri: string) => {
    switch (uri.replace('ipfs://', '')) {
      case 'bafkreibd6h3lwtyjzfh2ts47prtdzmooi54rjgqytnvbil3cuvjg2tkbd4':
        return {
          name: 'PLENTY',
          description: 'Plenty DeFi DAO',
          homepage: 'https://plentydefi.com',
          interfaces: ['TZIP-007-2021-04-17', 'TZIP-016-2021-04-17'],
        };
      case 'QmT4qMBAK6qqXvr9sy3zVAWxY9Xh8siyLD8uw2w1UT74GY':
        return {
          name: 'Wrap protocol FA2 tokens',
          homepage: 'https://github.com/bender-labs/wrap-tz-contracts',
          interfaces: ['TZIP-012', 'TZIP-016', 'TZIP-021'],
        };
      default:
        throw new Error(`IPFS hash ${uri.replace('ipfs://', '')} not mocked`);
    }
  }),
}));

jest.mock('@taquito/rpc', () => {
  const { castToBigNumber, ...actualRpc } = jest.requireActual('@taquito/rpc');

  const mockRpcClient = jest.fn().mockImplementation((url: string, chain?: string, httpBackend?: HttpBackend) => {
    const instance: RpcClient = new actualRpc.RpcClient(url, chain, httpBackend);

    instance.getChainId = jest.fn().mockReturnValue('NetXdQprcVkpaWU');
    instance.getConstants = jest.fn().mockReturnValue({ ...CONSTANTS, ...castToBigNumber(CONSTANTS, CONST_META) });
    instance.getProtocols = jest.fn().mockReturnValue(PROTOCOLS);
    instance.getRpcUrl = jest.fn().mockImplementation(() => RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]);

    instance.getBlockHeader = jest.fn().mockImplementation(async (opts?: RPCOptions) => {
      const key: string = quickHash('blockHeader', opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getBlockHeader.bind(instance, opts);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY);
      return fetchAndCache(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getBlockHash = jest.fn().mockImplementation(async (opts?: RPCOptions) => {
      return (await instance.getBlockHeader(opts)).hash;
    });

    instance.getManagerKey = jest.fn().mockImplementation(async (address: string, opts?: RPCOptions) => {
      const key: string = quickHash('managerKey', address, opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getManagerKey.bind(instance, address, opts);
      return fetchAndCache(key, callback, CACHE_DIRECTORY);
    });

    instance.getContract = jest.fn().mockImplementation(async (address: string, opts?: RPCOptions) => {
      const key: string = quickHash('contract', address, opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getContract.bind(instance, address, opts);
      const expiryOffset: number = address.startsWith('KT') || address === burnAddress ? BLOCKS_PER_CYCLE : 1;
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * expiryOffset);
      return fetchAndCache<ContractResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getScript = jest.fn().mockImplementation(async (address: string, opts?: RPCOptions) => {
      const key: string = quickHash('script', address, opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getScript.bind(instance, address, opts);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<ScriptResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getEntrypoints = jest.fn().mockImplementation(async (address: string, opts?: RPCOptions) => {
      const key: string = quickHash('entrypoints', address, opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getEntrypoints.bind(instance, address, opts);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<Record<string, string>>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getBigMapExpr = jest.fn().mockImplementation(async (id: string, expr: string, opts?: RPCOptions) => {
      const key: string = quickHash('bigMap', id, expr, opts?.block ?? 'head');
      const callback = actualRpc.RpcClient.prototype.getBigMapExpr.bind(instance, id, expr, opts);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<BigMapResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.simulateOperation = jest
      .fn()
      .mockImplementation(async (op: RPCSimulateOperationParam, opts?: RPCOptions) => {
        const stringified: string = op.operation.contents?.map((c) => JSON.stringify(c)).join(':') ?? '';
        const key: string = quickHash('simulate', stringified, opts?.block ?? 'head');
        const callback = actualRpc.RpcClient.prototype.simulateOperation.bind(instance, op, opts);
        const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
        return fetchAndCache(key, callback, CACHE_DIRECTORY, expiry);
      });

    instance.runView = jest.fn().mockImplementation(async (params: RPCRunViewParam, options?: RPCOptions) => {
      const { entrypoint, input } = params;

      if (entrypoint === 'getTotalSupply') {
        const mockSupply: BigNumber = mockNum(JSON.stringify(params), 1000000);
        return { data: { int: mockSupply.toString() } };
      }

      if (entrypoint === 'getBalance') {
        const mockBalance: BigNumber = mockNum(JSON.stringify(params), 10000);
        return { data: { int: mockBalance.toString() } };
      }

      if (entrypoint === 'balance_of' && Array.isArray(input)) {
        const fa2BalanceSchema: Schema = new Schema(FA2_BALANCE_RESPONSE_SCHEMA);
        const requestSchema: Schema = new Schema({ prim: 'pair', args: [{ prim: 'address' }, { prim: 'nat' }] });

        const mockBalance: MichelsonV1Expression[] = input.map((michelson: MichelsonV1Expression) => {
          const [owner, token_id] = Object.values<string>(requestSchema.Execute(michelson));
          const balance: BigNumber = mockNum(JSON.stringify(params) + JSON.stringify(michelson), 10000);
          return fa2BalanceSchema.Encode({ request: { owner, token_id }, balance });
        });

        return { data: mockBalance };
      }

      return actualRpc.RpcClient.prototype.runView.call(instance, params, options);
    });

    return instance;
  });

  return { ...actualRpc, castToBigNumber, RpcClient: mockRpcClient };
});

// Log http requests for debugging purposes
jest.mock('@taquito/http-utils', () => ({
  HttpBackend: jest.fn().mockImplementation(() => {
    return {
      createRequest: jest
        .fn()
        .mockImplementation(
          async ({ url, method = 'GET', query, headers, json = true }: HttpRequestOptions, data?: object | string) => {
            console.log('Request:', url);

            const keepalive: boolean = false;
            url += qs.stringify(query);
            headers ??= { ['Content-Type']: 'application/json' };
            const body: string = JSON.stringify(data);
            const res: Response = await fetch(url, { keepalive, method, headers, body });

            if (res.status === 404) {
              return undefined;
            }

            return json ? res.json() : res.text();
          }
        ),
    };
  }),
}));
